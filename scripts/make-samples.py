# Regenerates the fictional test resumes (needs: reportlab, python-docx, pillow).
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw
import docx

RESUMES = {
 "strong": """Priya Sample (fictional test resume)
EDUCATION
B.Tech in Computer Science and Engineering, Example Institute of Technology, 08/2021 - 05/2025
CGPA: 9.1/10
EXPERIENCE
Machine Learning Engineer, Demo Analytics, 01/2025 - 06/2026
- Built a forecasting model that cut error by 18% across 40 stores
- Deployed data pipelines processing 2 million records per day
PUBLICATIONS
P. Sample, Efficient transformers for crop disease detection, International Conference on Computer Vision Applications, 2025
PROJECTS
Crop disease classifier (2024): CNN trained on 20,000 images, 94% accuracy
Hindi question answering system (2023): fine-tuned language model, F1 score 0.81
SKILLS
Python, PyTorch, SQL, Docker, Statistics
LEADERSHIP AND VOLUNTEERING
President, Coding Club, 2023 - 2024
Volunteer teacher, rural digital literacy programme, 2022 - 2023
LANGUAGES
English, Hindi, German (A2)
IELTS 7.5""",
 "weak": """Rahul Sample (fictional test resume)
EDUCATION
Bachelor of Commerce, Example College, 2022 - 2025
CGPA: 6.0/10
SKILLS
MS Word, MS Excel, typing, communication, teamwork
HOBBIES
Cricket, listening to music, travelling with friends and watching documentaries
OBJECTIVE
Looking for an opportunity to learn new things and grow in a good organisation where I can use my skills.""",
}

for name, text in RESUMES.items():
    c = canvas.Canvas(f"test-resumes/{name}.pdf", pagesize=A4, invariant=1)
    y = 800
    for line in text.split("\n"):
        c.setFont("Helvetica-Bold" if line.isupper() else "Helvetica", 9.5)
        c.drawString(40, y, line)
        y -= 18
    c.save()
    d = docx.Document()
    for line in text.split("\n"):
        d.add_heading(line, 2) if line.isupper() else d.add_paragraph(line)
    d.save(f"test-resumes/{name}.docx")

# Image-only PDF: text drawn into a picture, so there is no text layer.
img = Image.new("RGB", (1240, 1754), "white")
ImageDraw.Draw(img).multiline_text((80, 80), RESUMES["strong"], fill="black", spacing=14, font_size=22)
c = canvas.Canvas("test-resumes/scanned.pdf", pagesize=A4, invariant=1)
c.drawImage(ImageReader(img), 0, 0, *A4)
c.save()
