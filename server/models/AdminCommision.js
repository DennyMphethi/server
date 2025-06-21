{
  _id: ObjectId,
  totalCommission: { type: Number, default: 0 },
  withdrawnCommission: { type: Number, default: 0 },
  transactions: [{ type: ObjectId, ref: 'Transaction' }],
  withdrawalHistory: [{
    amount: Number,
    bankDetails: Object,
    processedAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
