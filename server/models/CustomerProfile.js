{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', unique: true },
  balance: { type: Number, default: 0 },
  vouchers: [{
    code: String,
    amount: Number,
    type: { type: String, enum: ['shoprite', 'capitec', 'standardbank'] },
    redeemedAt: Date,
    status: { type: String, enum: ['pending', 'redeemed', 'failed'] }
  }],
  transactions: [{ type: ObjectId, ref: 'Transaction' }],
  createdAt: Date,
  updatedAt: Date
}
