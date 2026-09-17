export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  jobId?: string;
}

export interface MailSender {
  send(options: SendMailOptions): Promise<void>;
}
