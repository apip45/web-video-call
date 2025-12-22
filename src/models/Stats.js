/**
 * =============================================================================
 * STATS MODEL
 * =============================================================================
 * Schema untuk menyimpan statistik bandwidth dan usage
 */

const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['daily', 'hourly', 'call'],
        default: 'call'
    },
    roomId: {
        type: String,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Bandwidth stats
    bytesSent: {
        type: Number,
        default: 0
    },
    bytesReceived: {
        type: Number,
        default: 0
    },
    // Call stats
    callDuration: {
        type: Number, // in seconds
        default: 0
    },
    // Quality stats
    avgPacketLoss: {
        type: Number,
        default: 0
    },
    avgLatency: {
        type: Number,
        default: 0
    },
    avgJitter: {
        type: Number,
        default: 0
    },
    // Session info
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    }
}, {
    timestamps: true
});

// Index untuk query harian
statsSchema.index({ date: 1, type: 1 });

/**
 * Static method untuk aggregate daily stats
 */
statsSchema.statics.getDailyStats = async function(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await this.aggregate([
        {
            $match: {
                date: { $gte: startOfDay, $lte: endOfDay },
                type: 'call'
            }
        },
        {
            $group: {
                _id: null,
                totalBytesSent: { $sum: '$bytesSent' },
                totalBytesReceived: { $sum: '$bytesReceived' },
                totalCalls: { $sum: 1 },
                totalDuration: { $sum: '$callDuration' },
                avgPacketLoss: { $avg: '$avgPacketLoss' },
                avgLatency: { $avg: '$avgLatency' }
            }
        }
    ]);

    return result[0] || {
        totalBytesSent: 0,
        totalBytesReceived: 0,
        totalCalls: 0,
        totalDuration: 0,
        avgPacketLoss: 0,
        avgLatency: 0
    };
};

/**
 * Get weekly bandwidth stats
 */
statsSchema.statics.getWeeklyStats = async function() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await this.aggregate([
        {
            $match: {
                date: { $gte: weekAgo },
                type: 'call'
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                bytesSent: { $sum: '$bytesSent' },
                bytesReceived: { $sum: '$bytesReceived' },
                calls: { $sum: 1 },
                duration: { $sum: '$callDuration' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    return result;
};

const Stats = mongoose.model('Stats', statsSchema);

module.exports = Stats;
