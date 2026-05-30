const VALID_KEYS = ['abhay1', 'abhay2', 'abhay3', 'abhay4', 'abhay5'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { exploits, api_key } = req.query;

  if (!api_key) {
    return res.status(401).json({ 
      error: 'Missing API key', 
      usage: '?api_key=abhay1&exploits=9876543210',
      valid_keys: VALID_KEYS
    });
  }
  if (!VALID_KEYS.includes(api_key)) {
    return res.status(403).json({ error: 'Invalid API key', valid_keys: VALID_KEYS });
  }
  if (!exploits) {
    return res.status(400).json({ error: 'Missing number parameter', usage: '?api_key=KEY&exploits=9876543210' });
  }
  const phoneRegex = /^\d{10}$/;
  if (!phoneRegex.test(exploits)) {
    return res.status(400).json({ error: 'Invalid number. Use 10 digits.' });
  }

  const targetUrl = `https://exploitsindia.site/api/number.php?exploits=${exploits}`;

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
    
    // Parse cleaned text into JSON results
    const results = parseLookupResults(cleanedText, exploits);
    
    const jsonResponse = {
      success: true,
      total_results: results.length,
      results: results,
      developer: "abhay singh"
    };
    
    console.log(`[KEY_USED] ${api_key} | Number: ${exploits} | Results: ${results.length}`);
    res.status(200).json(jsonResponse);
    
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch from target', details: error.message });
  }
}

// Parser for the human-readable format
function parseLookupResults(text, searchedMobile) {
  const results = [];
  
  // Split by "📌 Additional Result:" or main result section
  // First, extract main result (before first "📌 Additional Result" if exists)
  let sections = [];
  if (text.includes('📌 Additional Result:')) {
    const parts = text.split(/📌 Additional Result:/);
    sections.push(parts[0]); // main result
    sections.push(...parts.slice(1)); // additional results
  } else {
    sections = [text];
  }
  
  for (let section of sections) {
    // Skip empty sections
    if (!section.trim() || section.trim().length < 20) continue;
    
    // Extract fields using regex
    const nameMatch = section.match(/👤\s*Name:\s*([^\n]+)/);
    const fatherMatch = section.match(/👨‍👦\s*Father Name:\s*([^\n]+)/);
    const mobileMatch = section.match(/📱\s*Mobile:\s*([^\n]+)/);
    const addressMatch = section.match(/🏠\s*Address:\s*([^\n]+(?:\n\s*[^📱👨‍👦👤📡📞🪪]+)*)/);
    const circleMatch = section.match(/📡\s*Circle:\s*([^\n]+)/);
    const alternateMatch = section.match(/📞\s*Alternate:\s*([^\n]+)/);
    const aadhaarMatch = section.match(/🪪\s*Aadhaar:\s*([^\n]+)/);
    
    // Clean up address (remove extra newlines/spaces)
    let address = addressMatch ? addressMatch[1].trim().replace(/\s+/g, ' ') : null;
    
    // Determine primary mobile: if this section is main result, use searchedMobile; else use extracted mobile
    let mobile = mobileMatch ? mobileMatch[1].trim() : null;
    if (!mobile && section.includes('Lookup Result for:')) mobile = searchedMobile;
    
    // Build result object matching required fields
    const resultObj = {
      address: address || null,
      email: null,  // Not available in format
      fname: fatherMatch ? fatherMatch[1].trim() : null,
      id: aadhaarMatch ? aadhaarMatch[1].trim() : (alternateMatch ? alternateMatch[1].trim() : null),
      mobile: mobile,
      name: nameMatch ? nameMatch[1].trim() : null
    };
    
    // Only add if at least name or mobile exists
    if (resultObj.name || resultObj.mobile) {
      results.push(resultObj);
    }
  }
  
  // Deduplicate by mobile number (keep first occurrence)
  const seen = new Set();
  return results.filter(r => {
    if (r.mobile && seen.has(r.mobile)) return false;
    if (r.mobile) seen.add(r.mobile);
    return true;
  });
}
