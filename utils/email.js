const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Etxplore <${process.env.EMAIL_FROM ||
      'noreply@etxplore.com'}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Brevo (Sendinblue) API Transport
      return nodemailer.createTransport({
        host: process.env.BREVO_HOST, // smtp-relay.brevo.com
        port: process.env.BREVO_PORT, // 587
        auth: {
          user: process.env.BREVO_USERNAME, // e.g. 98ac79001@smtp-brevo.com 
          pass: process.env.BREVO_PASSWORD // your Brevo SMTP password
        }
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // Send the actual email
  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject
    });

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText.convert(html)
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Etxplore Family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)'
    );
  }

  async sendEmailVerification() {
    await this.send('emailVerification', 'Please verify your email address');
  }

  async sendHostApproval() {
    await this.send('hostApproval', 'Congratulations! Your Host Application is Approved');
  }
};
