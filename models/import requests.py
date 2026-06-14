import requests

TELEGRAM_TOKEN = "8678835125:AAFljXzL4TwagyGt4uNtJEx3AAo75n0k384"
CHAT_ID = "5701063183"

def send_telegram(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    data = {"chat_id": CHAT_ID, "text": message}
    requests.post(url, data=data)

send_telegram("✅ البوت شغال تمام يا تها!")
