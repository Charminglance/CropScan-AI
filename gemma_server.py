from flask import Flask, request, jsonify
from transformers import pipeline
from PIL import Image
import torch
import requests
import base64
import io
import sys
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

print("Loading MobileNetV2 classifier...", flush=True)

classifier = pipeline(
    "image-classification",
    model="Diginsa/Plant-Disease-Detection-Project",
    device=0 if torch.cuda.is_available() else -1
)

print("MobileNetV2 loaded!", flush=True)
print("Gemma 4 E4B running via Ollama on port 11434", flush=True)
print("All models ready!", flush=True)

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        image_file = request.files['plant']
        image_bytes = image_file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

        # Step 1: MobileNetV2 classification
        results = classifier(image)
        top_result = results[0]
        disease_label = top_result['label']
        confidence = round(top_result['score'] * 100, 1)

        # Step 2: Convert image to base64 for Ollama
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        # Step 3: Gemma 4 via Ollama
        prompt = f"""You are an expert agricultural botanist AI.
A plant leaf image has been analyzed and classified as: "{disease_label}" with {confidence}% confidence.

Provide a detailed plant disease report:

1. **Plant & Disease**: What plant is this and what condition is detected?
2. **Visual Symptoms**: What visible signs confirm this diagnosis?
3. **Cause**: Is this fungal, bacterial, viral, or a nutrient deficiency?
4. **Severity**: Rate as Healthy / Mild / Moderate / Severe
5. **Treatment**: What should the farmer do immediately?
6. **Prevention**: How to prevent this in future crops?

Be specific, practical, and farmer-friendly."""

        response = requests.post('http://localhost:11434/api/generate', json={
            "model": "gemma4:e4b",
            "prompt": prompt,
            "images": [img_base64],
            "stream": False
        })

        result = response.json()
        explanation = result['response']

        return jsonify({
            "success": True,
            "classification": {
                "label": disease_label,
                "confidence": confidence,
                "all_results": results[:3]
            },
            "explanation": explanation
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Flask on port 5000...", flush=True)
    app.run(port=5000)