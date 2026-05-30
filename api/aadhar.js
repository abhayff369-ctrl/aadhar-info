const VALID_KEYS = ['abhay1', 'abhay2', 'abhay3', 'abhay4', 'abhay5'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { exploits, api_key } = req.query;

  // --- Multi-Key Authentication ---
  if (!api_key) {
    return res.status(401).json({ 
      error: 'Missing API key', 
      usage: '?api_key=abhay1&exploits=123456789012',
      valid_keys: VALID_KEYS
    });
  }
  if (!VALID_KEYS.includes(api_key)) {
    return res.status(403).json({ error: 'Invalid API key', valid_keys: VALID_KEYS });
  }
  
  // --- Aadhaar Validation (12 digits) ---
  if (!exploits) {
    return res.status(400).json({ 
      error: 'Missing Aadhaar parameter', 
      usage: '?api_key=KEY&exploits=123456789012' 
    });
  }
  
  // Remove any spaces or dashes before validation
  const rawAadhaar = String(exploits).replace(/[\s\-]/g, '');
  const aadhaarRegex = /^\d{12}$/;
  if (!aadhaarRegex.test(rawAadhaar)) {
    return res.status(400).json({ 
      error: 'Invalid Aadhaar. Use 12 digits (no spaces or dashes).',
      example: '123456789012'
    });
  }

  // Use cleaned Aadhaar in target URL
  const targetUrl = `https://exploitsindia.site/api/number.php?exploits=${rawAadhaar}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VercelBot/1.0)' }
    });
    let rawText = await response.text();

    // Remove BUY/SUPPORT footer lines
    const lines = rawText.split(/\r?\n/);
    const filteredLines = lines.filter(line => {
      const lower = line.toLowerCase();
      return !(lower.includes('buy api') || lower.includes('@cyb3rs0ldier') || 
               (lower.includes('support') && lower.includes('@')) ||
               (lower.includes('💳') && lower.includes('@')));
    });
    let cleanedText = filteredLines.join('\n');
    
    // Parse cleaned text into JSON results (passing Aadhaar as searched ID)
    const results = parseLookupResults(cleanedText, rawAadhaar);
    
    const jsonResponse = {
      success: true,
      total_results: results.length,
      results: results,
      developer: "abhay singh",
      queried_aadhaar: rawAadhaar
    };
    
    console.log(`[KEY_USED] ${api_key} | Aadhaar: ${rawAadhaar} | Results: ${results.length}`);
    res.status(200).json(jsonResponse);
    
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch from target', details: error.message });
  }
}

// Parser for the human-readable format
function parseLookupResults(text, searchedAadhaar) {
  const results = [];
  
  // Split by "📌 Additional Result:" or main result section
  let sections = [];
  if (text.includes('📌 Additional Result:')) {
    const parts = text.split(/📌 Additional Result:/);
    sections.push(parts[0]);
    sections.push(...parts.slice(1));
  } else {
    sections = [text];
  }
  
  for (let section of sections) {
    if (!section.trim() || section.trim().length < 20) continue;
    
    // Extract fields using regex
    const nameMatch = section.match(/👤\s*Name:\s*([^\n]+)/);
    const fatherMatch = section.match(/👨‍👦\s*Father Name:\s*([^\n]+)/);
    const mobileMatch = section.match(/📱\s*Mobile:\s*([^\n]+)/);
    const addressMatch = section.match(/🏠\s*Address:\s*([^\n]+(?:\n\s*[^📱👨‍👦👤📡📞🪪]+)*)/);
    const circleMatch = section.match(/📡\s*Circle:\s*([^\n]+)/);
    const alternateMatch = section.match(/📞\s*Alternate:\s*([^\n]+)/);
    const aadhaarMatch = section.match(/🪪\s*Aadhaar:\s*([^\n]+)/);
    
    let address = addressMatch ? addressMatch[1].trim().replace(/\s+/g, ' ') : null;
    let mobile = mobileMatch ? mobileMatch[1].trim() : null;
    
    // For main result, if no mobile found, don't use searchedAadhaar as mobile
    // Aadhaar goes to 'id' field primarily
    
    const resultObj = {
      address: address || null,
      email: null,
      fname: fatherMatch ? fatherMatch[1].trim() : null,
      id: aadhaarMatch ? aadhaarMatch[1].trim() : (alternateMatch ? alternateMatch[1].trim() : null),
      mobile: mobile,
      name: nameMatch ? nameMatch[1].trim() : null
    };
    
    if (resultObj.name || resultObj.mobile || resultObj.id) {
      results.push(resultObj);
    }
  }
  
  // Deduplicate by mobile number (or Aadhaar if mobile missing)
  const seen = new Set();
  return results.filter(r => {
    const key = r.mobile || r.id;
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  });
}
