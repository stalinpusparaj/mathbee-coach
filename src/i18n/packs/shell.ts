/**
 * Strings owned by the web platform work package (Android shell: leaving the app, files, voice).
 * Base tables win on key clashes. Tamil is a developer draft for native review.
 */
export const EN: Record<string, string> = {
  // "Bye-bye" sheet shown when back is pressed on the garden map or welcome screen
  'shell.bye.title': 'Bye-bye for now?',
  'shell.bye.body': 'Your garden is saved. The bee will be here next time.',
  'shell.bye.stay': 'Keep playing',
  'shell.bye.leave': 'Bye-bye',
  // files and printing (parent area)
  'shell.saved': 'Saved.',
  'shell.saveDeclined': 'Not saved. You can try again.',
  'shell.saveUnavailable': 'Saving is not possible here. Copy the text below instead.',
  'shell.share': 'Share…',
  'shell.shared': 'Ready to share.',
  'shell.printError': 'Printing did not start. Please try again.',
  // narration voice (parent settings)
  'shell.installVoice': 'Install Tamil voice',
  'shell.installVoiceHelp': 'Opens your phone’s speech settings. Narration uses the phone’s own voice, on the device.',
};

export const TA: Record<string, string> = {
  'shell.bye.title': 'இப்போது போய் வரலாமா?',
  'shell.bye.body': 'உன் தோட்டம் சேமிக்கப்பட்டது. அடுத்த முறையும் தேனீ இங்கே இருக்கும்.',
  'shell.bye.stay': 'தொடர்ந்து விளையாடு',
  'shell.bye.leave': 'போய் வருகிறேன்',
  'shell.saved': 'சேமிக்கப்பட்டது.',
  'shell.saveDeclined': 'சேமிக்கப்படவில்லை. மீண்டும் முயலலாம்.',
  'shell.saveUnavailable': 'இங்கே சேமிக்க முடியாது. கீழே உள்ள உரையை நகலெடுக்கவும்.',
  'shell.share': 'பகிர்…',
  'shell.shared': 'பகிரத் தயார்.',
  'shell.printError': 'அச்சிடுதல் தொடங்கவில்லை. மீண்டும் முயலவும்.',
  'shell.installVoice': 'தமிழ் குரலை நிறுவு',
  'shell.installVoiceHelp': 'தொலைபேசியின் பேச்சு அமைப்புகளைத் திறக்கும். விவரிப்பு தொலைபேசியின் சொந்தக் குரலில், சாதனத்திலேயே ஒலிக்கும்.',
};
