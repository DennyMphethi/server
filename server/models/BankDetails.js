{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User' },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  accountType: { type: String, enum: ['savings', 'current', 'cheque'] },
  branchCode: String,
  isVerified: { type: Boolean, default: false },
  createdAt: Date,
  updatedAt: Date
}
