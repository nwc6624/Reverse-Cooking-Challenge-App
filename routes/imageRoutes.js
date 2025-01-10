import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import { MongoClient } from "mongodb";

// Router instance
const router = express.Router();

// AWS S3 Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Multer configuration for memory storage (no local disk storage)
const upload = multer({ storage: multer.memoryStorage() });

// **POST /api/images/upload**
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const file = req.file; // Multer automatically adds file info
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Prepare S3 upload parameters
    const params = {
      Bucket: process.env.S3_BUCKET_NAME, // Bucket name from .env
      Key: `${Date.now()}_${file.originalname}`, // Unique file key
      Body: file.buffer, // Image content
      ContentType: file.mimetype, // Image MIME type (e.g., "image/png")
    };

    // Upload image to S3
    const result = await s3.upload(params).promise();
    console.log("File uploaded to S3:", result.Location);

    // Connect to MongoDB and save image metadata
    const mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db("reverseCookingApp");
    const imagesCollection = db.collection("images");
    await imagesCollection.insertOne({
      imageUrl: result.Location, // S3 image URL
      timestamp: new Date(),
    });

    // Respond with the S3 image URL
    res.status(200).json({
      message: "Image uploaded successfully!",
      url: result.Location,
    });

    // Close MongoDB connection
    await mongoClient.close();
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

export default router;
