// List of valid API keys from environment variables
const VALID_KEYS = [
  process.env.demo,
  process.env.API_KEY_2,
  process.env.API_KEY_3,
  process.env.API_KEY_4,
  process.env.API_KEY_5
].filter(Boolean);  // Remove undefined

const FOOTER = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 BUY API : @Cyb3rS0ldier
🆘 SUPPORT : @Cyb3rS0ldier
━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { exploits, api_key } = req.query;

  // --- Multi-Key Authentication ---
  if (!api_key) {
    return res.status(401).json({ 
      error: 'Missing API key', 
      usage: '?api_key=YOUR_KEY&exploits=9876543210' 
    });
  }

  if (!VALID_KEYS.includes(api_key)) {
    return res.status(403).json({ error: 'Invalid or expired API key' });
  }

  // --- Validate exploits parameter ---
  if (!exploits) {
    return res.status(400).json({ 
      error: 'Missing number parameter', 
      usage: '?api_key=KEY&exploits=9876543210' 
    });
  }

  const phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(exploits)) {
    return res.status(400).json({ error: 'Invalid number. Use 10 digits.' });
  }

  const targetUrl = `https://exploitsindia.site/api/number.php?exploits=${exploits}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VercelBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      }
    });

    let content = await response.text();

    // --- Remove any "developer by abhay singh" line (case-insensitive) ---
    const removePattern = /developer\s+by\s+abhay\s+singh/gi;
    content = content.replace(removePattern, '');

    // --- Append required footer ---
    content = content + FOOTER;

    res.status(response.status).send(content);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from target', 
      details: error.message 
    });
  }
}
