import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), 'creative-engine.html');
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(htmlContent);
  } catch (error) {
    console.error('Error serving creative-engine.html:', error);
    res.status(500).json({ error: 'Failed to load Creative Analysis Engine' });
  }
}