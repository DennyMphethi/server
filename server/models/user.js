{
  _id: ObjectId,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  phone: { type: String, required: true },
  userType: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  isVerified: { type: Boolean, default: false },
  createdAt: Date,
  updatedAt: Date
}
