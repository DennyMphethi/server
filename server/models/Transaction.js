{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User' },
  type: { type: String, enum: ['redeem', 'withdrawal', 'transfer'] },
  amount: Number,
  fee: { type: Number, default: 0 }, // 3% commission
  status: { type: String, enum: ['pending', 'completed', 'failed'] },
  details: Object,
  recipientId: { type: ObjectId, ref: 'User' }, // for transfers
  createdAt: Date,
  updatedAt: Date
}
