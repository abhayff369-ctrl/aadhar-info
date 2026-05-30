// File: api/aadhar.js
// Deploy on Vercel as a serverless function

const VALID_KEYS = [
  'abhay1', 'abhay2', 'abhay3', 'abhay4', 'abhay5',
  'demo123'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { aadhr, api_key } = req.query;

  // --- Authentication ---
  if (!api_key) {
    return res.status(401).json({ 
      success: false,
      error: 'Missing API key', 
      usage: '?api_key=demo123&aadhr=123456789012',
      valid_keys: VALID_KEYS.filter(k => k !== 'demo123' ? 'premium' : 'demo'),
      demo_key: 'demo123'
    });
  }
  
  if (!VALID_KEYS.includes(api_key)) {
    return res.status(403).json({ 
      success: false,
      error: 'Invalid API key', 
      valid_keys: VALID_KEYS,
      demo_key: 'demo123'
    });
  }
  
  // --- Aadhaar Validation ---
  if (!aadhr) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing Aadhaar parameter', 
      usage: '?api_key=KEY&aadhr=123456789012'
    });
  }
  
  const rawAadhaar = String(aadhr).replace(/[\s\-]/g, '');
  const aadhaarRegex = /^\d{12}$/;
  if (!aadhaarRegex.test(rawAadhaar)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid Aadhaar number', 
      message: 'Aadhaar must be exactly 12 digits (no spaces or dashes)',
      provided: aadhr,
      example: '572783453594'
    });
  }

  const targetUrl = `https://exploitsindia.site/api/number.php?exploits=${rawAadhaar}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; VercelBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      }
    });

    let rawText = await response.text();

    // --- Check for "no data" indicators ---
    const noDataIndicators = [
      '❌ Missing number',
      'no result',
      'not found',
      'no record',
      'invalid aadhaar',
      'not exist',
      'no data found',
      '0 results'
    ];
    
    const lowerText = rawText.toLowerCase();
    const isNoData = noDataIndicators.some(indicator => 
      lowerText.includes(indicator.toLowerCase())
    ) || rawText.trim().length < 20;  // Very short response likely means no data
    
    // --- Remove BUY/SUPPORT footer lines ---
    const lines = rawText.split(/\r?\n/);
    const filteredLines = lines.filter(line => {
      const lower = line.toLowerCase();
      return !(
        lower.includes('buy api') ||
        lower.includes('@cyb3rs0ldier') ||
        (lower.includes('support') && lower.includes('@')) ||
        (lower.includes('💳') && lower.includes('@')) ||
        (lower.includes('🆘') && lower.includes('@')) ||
        lower.includes('cyb3rs0ldier')
      );
    });
    
    let cleanedText = filteredLines.join('\n');
    cleanedText = cleanedText.replace(/\n\s*\n/g, '\n\n').trim();
    
    // --- Parse results or handle empty case ---
    let results = [];
    let message = null;
    
    if (isNoData || cleanedText.length < 30) {
      message = 'No data found for this Aadhaar number. The Aadhaar may be invalid, not registered, or the source has no records.';
      results = [];
    } else {
      results = parseLookupResults(cleanedText, rawAadhaar);
      if (results.length === 0) {
        message = 'Lookup completed but no valid person records were extracted. The response may be malformed or the Aadhaar has no associated data.';
      }
    }
    
    // --- Final JSON Response ---
    const jsonResponse = {
      success: true,
      total_results: results.length,
      results: results,
      developer: "abhay singh",
      queried_aadhaar: rawAadhaar,
      api_key_used: api_key === 'demo123' ? 'demo (limited)' : 'premium'
    };
    
    if (message) {
      jsonResponse.message = message;
    }
    
    console.log(`[AADHAAR_API] Key: ${api_key} | Aadhaar: ${rawAadhaar} | Results: ${results.length} | HasData: ${!isNoData}`);
    
    res.status(200).json(jsonResponse);
    
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch data from source', 
      details: error.message,
      suggestion: 'Try again later or verify the Aadhaar number'
    });
  }
}

/**
 * Parse human-readable lookup result into structured JSON
 */
function parseLookupResults(text, searchedAadhaar) {
  const results = [];
  
  if (!text || text.length < 50) return results;
  
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
    
    const nameMatch = section.match(/👤\s*Name:\s*([^\n]+)/);
    const fatherMatch = section.match(/👨‍👦\s*Father Name:\s*([^\n]+)/);
    const mobileMatch = section.match(/📱\s*Mobile:\s*([^\n]+)/);
    const addressMatch = section.match(/🏠\s*Address:\s*([^\n]+(?:\n\s*[^📱👨‍👦👤📡📞🪪]+)*)/);
    const circleMatch = section.match(/📡\s*Circle:\s*([^\n]+)/);
    const alternateMatch = section.match(/📞\s*Alternate:\s*([^\n]+)/);
    const aadhaarMatch = section.match(/🪪\s*Aadhaar:\s*([^\n]+)/);
    
    let address = addressMatch ? addressMatch[1].trim().replace(/\s+/g, ' ') : null;
    let mobile = mobileMatch ? mobileMatch[1].trim() : null;
    
    let id = null;
    if (aadhaarMatch) {
      id = aadhaarMatch[1].trim();
    } else if (alternateMatch) {
      id = alternateMatch[1].trim();
    }
    
    const resultObj = {
      address: address || null,
      email: null,
      fname: fatherMatch ? fatherMatch[1].trim() : null,
      id: id,
      mobile: mobile,
      name: nameMatch ? nameMatch[1].trim() : null,
      circle: circleMatch ? circleMatch[1].trim() : null,
      alternate: alternateMatch ? alternateMatch[1].trim() : null
    };
    
    if (resultObj.name || resultObj.mobile || resultObj.id) {
      results.push(resultObj);
    }
  }
  
  // Deduplicate
  const seen = new Set();
  return results.filter(r => {
    const key = r.mobile || r.id;
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  });
}
