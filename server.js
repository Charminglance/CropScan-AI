import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import FormData from 'form-data';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static('.'));

app.post('/analyze', upload.single('plant'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;
        const mimeType = req.file.mimetype;

        const form = new FormData();
        form.append('plant', imageBuffer, {
            filename: req.file.originalname,
            contentType: mimeType
        });

        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        const data = await response.json();

        if (!data.success) {
            res.json({ success: false, error: data.error });
            return;
        }

        res.json({
            success: true,
            classification: data.classification,
            explanation: data.explanation
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});