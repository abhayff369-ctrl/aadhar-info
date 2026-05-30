// File: api/aadhar.js
// Fixed parser – now extracts results reliably

const VALID_KEYS = [
  'abhay1', 'abhay2', 'abhay3', 'abhay4', 'abhay5',
  'demo123'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { aadhr, api_key, debug } = req.query;

  // --- Authentication ---
  if (!api_key) {
    return res.status(401).json({ 
      success: false,
      error: 'Missing API key', 
      valid_keys: VALID_KEYS
    });
  }
  if (!VALID_KEYS.includes(api_key)) {
    return res.status(403).json({ success: false, error: 'Invalid API key' });
  }
  
  // --- Aadhaar Validation ---
  if (!aadhr) {
    return res.status(400).json({ success: false, error: 'Missing aadhr parameter' });
  }
  
  const rawAadhaar = String(aadhr).replace(/[\s\-]/g, '');
  if (!/^\d{12}$/.test(rawAadhaar)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid Aadhaar. Use 12 digits.' 
    });
  }

  const targetUrl = `https://exploitsindia.site/api/number.php?exploits=${rawAadhaar}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VercelBot/1.0)' }
    });
    
    let rawText = await response.text();
    
    // Log raw response for debugging (visible in Vercel logs)
    console.log(`[RAW_RESPONSE] Aadhaar: ${rawAadhaar} | Length: ${rawText.length}`);
    console.log(`[RAW_PREVIEW] ${rawText.substring(0, 500)}`);

    // --- Remove BUY/SUPPORT footer lines ---
    const lines = rawText.split(/\r?\n/);
    const filteredLines = lines.filter(line => {
      const lower = line.toLowerCase();
      return !(
        lower.includes('buy api') ||
        lower.includes('@cyb3rs0ldier') ||
        (lower.includes('support') && lower.includes('@')) ||
        lower.includes('cyb3rs0ldier')
      );
    });
    let cleanedText = filteredLines.join('\n');
    
    // --- Parse results using improved function ---
    const results = parseLookupResultsImproved(cleanedText, rawAadhaar);
    
    const jsonResponse = {
      success: true,
      total_results: results.length,
      results: results,
      developer: "abhay singh",
      queried_aadhaar: rawAadhaar,
      api_key_used: api_key === 'demo123' ? 'demo' : 'premium'
    };
    
    // If debug=true, include raw response for inspection
    if (debug === 'true') {
      jsonResponse.debug_raw_response = rawText.substring(0, 2000);
      jsonResponse.debug_cleaned = cleanedText.substring(0, 1000);
    }
    
    res.status(200).json(jsonResponse);
    
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Improved parser – multiple strategies to extract data
 */
function parseLookupResultsImproved(text, searchedAadhaar) {
  const results = [];
  
  if (!text || text.length < 20) {
    console.log('[PARSER] Text too short, returning empty');
    return results;
  }
  
  // Strategy 1: Split by common separators
  let sections = [];
  
  // Try to split by "📌 Additional Result:" or "Additional Result"
  if (text.includes('📌 Additional Result')) {
    sections = text.split(/📌\s*Additional\s*Result:?/i);
  } 
  else if (text.includes('Additional Result')) {
    sections = text.split(/Additional\s*Result:?/i);
  }
  else {
    // If no additional results, treat whole text as one section
    sections = [text];
  }
  
  console.log(`[PARSER] Found ${sections.length} sections`);
  
  for (let idx = 0; idx < sections.length; idx++) {
    let section = sections[idx];
    if (!section.trim() || section.trim().length < 30) continue;
    
    // Extract fields using flexible patterns (allow missing spaces, different emojis)
    const extract = (pattern) => {
      const match = section.match(new RegExp(pattern, 'i'));
      return match ? match[1].trim() : null;
    };
    
    // Try multiple patterns for each field
    let name = extract('👤\\s*Name\\s*:\\s*([^\\n\\r]+)') ||
               extract('Name\\s*:\\s*([^\\n\\r]+)');
               
    let fname = extract('👨‍👦\\s*Father\\s*Name\\s*:\\s*([^\\n\\r]+)') ||
                extract('Father\\s*Name\\s*:\\s*([^\\n\\r]+)');
                
    let mobile = extract('📱\\s*Mobile\\s*:\\s*([^\\n\\r]+)') ||
                 extract('Mobile\\s*:\\s*([^\\n\\r]+)');
                 
    let address = extract('🏠\\s*Address\\s*:\\s*([^\\n\\r]+(?:\\n[^📱👨‍👦👤📡📞🪪]+)*)') ||
                  extract('Address\\s*:\\s*([^\\n\\r]+)');
                  
    let circle = extract('📡\\s*Circle\\s*:\\s*([^\\n\\r]+)') ||
                 extract('Circle\\s*:\\s*([^\\n\\r]+)');
                 
    let alternate = extract('📞\\s*Alternate\\s*:\\s*([^\\n\\r]+)') ||
                    extract('Alternate\\s*:\\s*([^\\n\\r]+)');
                    
    let aadhaar = extract('🪪\\s*Aadhaar\\s*:\\s*([^\\n\\r]+)') ||
                  extract('Aadhaar\\s*:\\s*([^\\n\\r]+)');
    
    // Clean up address (remove extra newlines)
    if (address) {
      address = address.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
    // If we didn't get mobile from pattern, try line-by-line in this section
    if (!mobile) {
      const lines = section.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes('Mobile') || line.includes('📱')) {
          const match = line.match(/(\d{10})/);
          if (match) mobile = match[1];
        }
      }
    }
    
    // Build result object
    const resultObj = {
      address: address || null,
      email: null,
      fname: fname || null,
      id: aadhaar || alternate || null,
      mobile: mobile || null,
      name: name || null
    };
    
    // Add extra fields for debugging
    if (circle) resultObj.circle = circle;
    if (alternate) resultObj.alternate = alternate;
    
    // Only add if we have at least a name or mobile
    if (resultObj.name || resultObj.mobile || resultObj.id) {
      results.push(resultObj);
      console.log(`[PARSER] Extracted: ${resultObj.name || 'unknown'} | ${resultObj.mobile || 'no mobile'}`);
    }
  }
  
  // Deduplicate
  const seen = new Set();
  const unique = results.filter(r => {
    const key = r.mobile || r.id;
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  });
  
  console.log(`[PARSER] Total unique results: ${unique.length}`);
  return unique;
}
