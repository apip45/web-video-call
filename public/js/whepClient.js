/**
 * =============================================================================
 * WHEP CLIENT
 * =============================================================================
 * WebRTC-HTTP Egress Protocol client untuk menonton stream dari MediaMTX.
 *
 * Alur:
 * 1. Buat RTCPeerConnection dengan transceiver recvonly (video + audio)
 * 2. Buat SDP offer, tunggu ICE gathering selesai (non-trickle)
 * 3. POST offer ke <whepUrl> dengan header Authorization: Bearer <token>
 * 4. Terima SDP answer + Location header (resource untuk DELETE)
 * 5. Track masuk melalui ontrack -> dikumpulkan ke MediaStream
 *
 * Referensi: https://mediamtx.org/docs/read/webrtc
 */

class WhepClient {
    /**
     * @param {Object} options
     * @param {string} options.url - URL WHEP (…/<path>/whep)
     * @param {string} [options.token] - Token read MediaMTX (Bearer)
     * @param {Array} [options.iceServers] - ICE servers dari server
     * @param {number} [options.iceGatheringTimeout=3000] - Max tunggu ICE gathering (ms)
     * @param {Function} [options.onTrack] - Callback (stream, track) saat track diterima
     * @param {Function} [options.onStateChange] - Callback (state) perubahan koneksi
     * @param {Function} [options.onError] - Callback (error)
     */
    constructor(options = {}) {
        this.url = options.url;
        this.token = options.token || '';
        this.iceServers = options.iceServers || [];
        this.iceGatheringTimeout = options.iceGatheringTimeout || 3000;

        this.pc = null;
        this.stream = null;
        this.resourceUrl = null;
        this.isActive = false;

        this.onTrack = options.onTrack || (() => {});
        this.onStateChange = options.onStateChange || (() => {});
        this.onError = options.onError || (() => {});

        console.log('[WHEP] 🔧 Client initialized');
        console.log(`[WHEP] 🌐 URL: ${this.url}`);
    }

    /**
     * Mulai menonton stream
     * @returns {Promise<MediaStream>}
     */
    async start() {
        if (this.isActive) {
            console.log('[WHEP] ⚠️ Sudah aktif, stop dulu sebelum start ulang');
            await this.stop();
        }

        console.log('[WHEP] ▶️ Starting WHEP playback...');

        try {
            this.pc = new RTCPeerConnection({
                iceServers: this.iceServers,
                bundlePolicy: 'max-bundle'
            });

            this.stream = new MediaStream();

            this.pc.addEventListener('track', (event) => {
                console.log(`[WHEP] 🎬 Remote track: ${event.track.kind}`);
                if (event.track.kind === 'audio') {
                    // Audio stream MediaMTX kadang datang lebih dulu; pastikan tidak delay
                    event.track.contentHint = 'speech';
                }
                this.stream.addTrack(event.track);
                this.onTrack(this.stream, event.track);
            });

            this.pc.addEventListener('iceconnectionstatechange', () => {
                const state = this.pc?.iceConnectionState;
                console.log(`[WHEP] 🔄 ICE state: ${state}`);
                if (state === 'failed') {
                    this.onStateChange('failed');
                }
            });

            this.pc.addEventListener('connectionstatechange', () => {
                const state = this.pc?.connectionState;
                console.log(`[WHEP] 🔄 Connection state: ${state}`);
                this.onStateChange(state);
            });

            // Hanya menerima media
            this.pc.addTransceiver('video', { direction: 'recvonly' });
            this.pc.addTransceiver('audio', { direction: 'recvonly' });

            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            // WHEP MediaMTX bersifat non-trickle: tunggu ICE gathering selesai
            await this.waitForIceGathering();

            const localSdp = this.pc.localDescription?.sdp;
            if (!localSdp) throw new Error('SDP lokal tidak tersedia');

            console.log('[WHEP] 📤 Mengirim offer ke server...');
            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sdp',
                    ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
                },
                body: localSdp
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`WHEP ${response.status}${errorText ? ': ' + errorText.slice(0, 160) : ''}`);
            }

            // Location header menunjuk resource untuk DELETE saat stop
            const location = response.headers.get('Location');
            if (location) {
                this.resourceUrl = this.resolveUrl(location);
                console.log(`[WHEP] 📍 Resource: ${this.resourceUrl}`);
            }

            const answerSdp = await response.text();
            if (!answerSdp) throw new Error('SDP answer kosong');

            await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            this.isActive = true;
            console.log('[WHEP] ✅ Playback aktif');
            return this.stream;
        } catch (error) {
            console.error('[WHEP] ❌ Gagal start:', error.message);
            this.onError(error);
            await this.stop();
            throw error;
        }
    }

    /**
     * Hentikan playback dan bebaskan resource di MediaMTX
     */
    async stop() {
        console.log('[WHEP] ⏹️ Stopping playback...');

        const resourceUrl = this.resourceUrl;
        this.resourceUrl = null;
        this.isActive = false;

        if (this.pc) {
            try {
                this.pc.close();
            } catch (error) {
                // noop
            }
            this.pc = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (resourceUrl) {
            try {
                await fetch(resourceUrl, {
                    method: 'DELETE',
                    headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
                });
                console.log('[WHEP] 🗑️ Resource dihapus');
            } catch (error) {
                console.warn('[WHEP] ⚠️ Gagal hapus resource:', error.message);
            }
        }

        console.log('[WHEP] ✅ Playback dihentikan');
    }

    /**
     * Apakah sedang aktif
     * @returns {boolean}
     */
    isPlaying() {
        return this.isActive;
    }

    /**
     * Tunggu ICE gathering selesai (dengan batas waktu)
     * @returns {Promise<void>}
     */
    waitForIceGathering() {
        return new Promise((resolve) => {
            if (!this.pc || this.pc.iceGatheringState === 'complete') {
                return resolve();
            }

            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                this.pc?.removeEventListener('icegatheringstatechange', onChange);
                clearTimeout(timer);
                resolve();
            };

            const onChange = () => {
                if (this.pc?.iceGatheringState === 'complete') finish();
            };

            this.pc.addEventListener('icegatheringstatechange', onChange);
            const timer = setTimeout(() => {
                console.warn('[WHEP] ⏱️ ICE gathering timeout, lanjut dengan kandidat yang ada');
                finish();
            }, this.iceGatheringTimeout);
        });
    }

    /**
     * Resolve URL relatif (Location header) terhadap URL WHEP
     * @param {string} location
     * @returns {string}
     */
    resolveUrl(location) {
        try {
            return new URL(location, this.url).toString();
        } catch (error) {
            return location;
        }
    }
}

// Export untuk penggunaan lain bila diperlukan
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhepClient;
}
