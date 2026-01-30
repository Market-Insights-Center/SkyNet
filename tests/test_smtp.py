
import configparser
import smtplib
from email.mime.text import MIMEText
import os

def test_smtp():
    config = configparser.ConfigParser()
    config_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'config.ini'))
    print(f"Reading config from: {config_path}")
    read_files = config.read(config_path)
    if not read_files:
        print("Failed to read config file!")
        return

    try:
        smtp_server = config.get('EMAIL_CONFIG', 'SMTP_SERVER')
        smtp_port = config.getint('EMAIL_CONFIG', 'SMTP_PORT')
        sender_email = config.get('EMAIL_CONFIG', 'SENDER_EMAIL')
        sender_password = config.get('EMAIL_CONFIG', 'SENDER_PASSWORD')
        recipient = config.get('EMAIL_CONFIG', 'RECIPIENT_EMAIL')
    except Exception as e:
        print(f"Missing config keys: {e}")
        return

    print(f"Server: {smtp_server}:{smtp_port}")
    print(f"User: {sender_email}")
    print(f"Target: {recipient}")

    msg = MIMEText("This is a test email from SkyNet Debugger.")
    msg['Subject'] = "SkyNet SMTP Test"
    msg['From'] = sender_email
    msg['To'] = recipient

    try:
        print("Connecting...")
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.set_debuglevel(1) # verbose
            server.starttls()
            print("Logging in...")
            server.login(sender_email, sender_password)
            print("Sending...")
            server.send_message(msg)
            print("Success!")
    except Exception as e:
        print(f"SMTP FAILED: {e}")

if __name__ == "__main__":
    test_smtp()
