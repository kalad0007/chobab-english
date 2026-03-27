const apiKey = 'AIzaSyAF06B_zEgB9ywgErZcswvbWnrRYsaEUkg'
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contents: [{ parts: [{ text: 'hello' }] }] })
})
  .then(res => res.text())
  .then(text => console.log('Result:', text))
  .catch(err => {
    console.error('Error Name:', err.name)
    console.error('Error Message:', err.message)
    console.error('Error Cause:', err.cause)
  })
