// service-worker.js
const EMAILJS_SERVICE_ID = "service_sv1ialy";
const EMAILJS_TEMPLATE_ID = "template_797tjor";

let settings = {
  publicKey: '',
  emails: [],
  subject: '',
  message: '',
  interval: 5,
  isRunning: false,
  nextSendTime: null,
  sendCount: 0
};

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'START_SENDING':
      settings = { ...settings, ...data, isRunning: true };
      startScheduler();
      break;
      
    case 'STOP_SENDING':
      settings.isRunning = false;
      break;
      
    case 'UPDATE_SETTINGS':
      settings = { ...settings, ...data };
      break;
  }
});

function startScheduler() {
  if (!settings.isRunning) return;
  
  const now = Date.now();
  const intervalMs = settings.interval * 60 * 1000;
  
  const nextTime = settings.nextSendTime || (now + intervalMs);
  const delay = Math.max(0, nextTime - now);
  
  setTimeout(async () => {
    if (settings.isRunning) {
      await sendAllEmails();
      settings.sendCount++;
      settings.nextSendTime = Date.now() + intervalMs;
      
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_STATUS',
            data: {
              sendCount: settings.sendCount,
              nextSendTime: settings.nextSendTime
            }
          });
        });
      });
      
      startScheduler();
    }
  }, delay);
}

async function sendAllEmails() {
  if (!settings.emails || settings.emails.length === 0) return;
  
  try {
    importScripts('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js');
    emailjs.init(settings.publicKey);
    
    for (let i = 0; i < settings.emails.length; i++) {
      const email = settings.emails[i];
      await sendEmail(email, i + 1);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Error in service worker:', error);
  }
}

async function sendEmail(email, index) {
  try {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ar-EG');
    const dateString = now.toLocaleDateString('ar-EG');
    
    let message = settings.message
      .replace(/{time}/g, timeString)
      .replace(/{date}/g, dateString)
      .replace(/{count}/g, settings.sendCount + 1)
      .replace(/{email}/g, email)
      .replace(/{index}/g, index);
    
    const templateParams = {
      to_email: email,
      subject: settings.subject,
      message: message,
      time: timeString,
      date: dateString,
      count: settings.sendCount + 1,
      index: index
    };
    
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams
    );
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});