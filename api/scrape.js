// Hardcoded multi-key system: abhay1 to abhay5
const VALID_KEYS = [
  'abhay1',
  'abhay2',
  'abhay3',
  'abhay4',
  'abhay5'
];

// Credit line to add (exactly as requested)
const DEVELOPER_CREDIT = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\ndeveloper by abhay singh\n━━━━━━━━━━━━━━━━━━━━━━━━━━━';

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
      usage: '?api_key=abhay1&exploits=9876543210',
      valid_keys: VALID_KEYS
    });
  }

  if (!VALID_KEYS.includes(api_key)) {
    return res.status(403).json({ 
      error: 'Invalid API key', 
      valid_keys: VALID_KEYS
    });
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

    // --- Remove all lines containing BUY API / SUPPORT / @Cyb3rS0ldier ---
    // Split into lines, filter out unwanted lines, then rejoin
    const lines = content.split(/\r?\n/);
    const filteredLines = lines.filter(line => {
      const lowerLine = line.toLowerCase();
      // Remove if line contains any of these patterns
      const shouldRemove = 
        lowerLine.includes('buy api') ||
        lowerLine.includes('@cyb3rs0ldier') ||
        lowerLine.includes('support') && lowerLine.includes('@') || // catches "🆘 SUPPORT : @Cyb3rS0ldier"
        lowerLine.includes('💳') && lowerLine.includes('@') ||
        (lowerLine.includes('━━━━') && lowerLine.includes('buy')); // catch divider lines adjacent to buy/support
        
      return !shouldRemove;
    });
    
    // Also remove any leftover standalone divider lines that are empty or just dashes (optional)
    let cleanedContent = filteredLines.join('\n');
    
    // Remove duplicate empty lines
    cleanedContent = cleanedContent.replace(/\n\s*\n/g, '\n\n');
    
    // Trim trailing/leading whitespace
    cleanedContent = cleanedContent.trim();
    
    // --- Append developer credit at the end ---
    const finalContent = cleanedContent + DEVELOPER_CREDIT;

    console.log(`[KEY_USED] ${api_key} accessed number: ${exploits} | Filtered length: ${finalContent.length}`);

    res.status(response.status).send(finalContent);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch from target', 
      details: error.message 
    });
  }
}
