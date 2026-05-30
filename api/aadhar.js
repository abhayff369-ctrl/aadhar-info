// File: api/aadhar.js
// Deploy on Vercel as a serverless function

const VALID_KEYS = [
  'abhay1',
  'abhay2', 
  'abhay3',
  'abhay4',
  'abhay5',
  'demo123'        // Demo key added for testing
];

export default async function handler(req, res) {
  // Enable CORS for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  const { aadhr, api_key } = req.query;

  // --- Multi-Key Authentication ---
  if (!api_key) {
    return res.status(401).json({ 
      success: false,
      error: 'Missing API key', 
      usage: '?api_key=demo123&aadhr=123456789012',
      valid_keys: VALID_KEYS,
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
  
  // --- Aadhaar Validation (12 digits) ---
  if (!aadhr) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing Aadhaar parameter', 
      usage: '?api_key=KEY&aadhr=123456789012',
      example: '/api/aadhar?api_key=demo123&aadhr=572783453594'
    });
  }
  
  // Remove any spaces or dashes before validation
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

  // Target endpoint (external API)
  const targetUrl = `https://exploitsindia.site/api/number.php?exploits=${rawAadhaar}`;

  try {
    // Fetch data from target
    const response = await fetch(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; VercelBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      },
      timeout: 10000  // 10 second timeout
    });

    let rawText = await response.text();

    // --- Remove BUY/SUPPORT footer lines ---
    const lines = rawText.split(/\r?\n/);
    const filteredLines = lines.filter(line => {
      const lower = line.toLowerCase();
      // Remove lines containing buy/support/telegram credits
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
    
    // Remove extra blank lines
    cleanedText = cleanedText.replace(/\n\s*\n/g, '\n\n').trim();
    
    // --- Parse cleaned text into JSON results ---
    const results = parseLookupResults(cleanedText, rawAadhaar);
    
    // --- Final JSON Response ---
    const jsonResponse = {
      success: true,
      total_results: results.length,
      results: results,
      developer: "abhay singh",
      queried_aadhaar: rawAadhaar,
      api_key_used: api_key === 'demo123' ? 'demo (limited)' : 'premium'
    };
    
    // Log usage (visible in Vercel logs)
    console.log(`[AADHAAR_API] Key: ${api_key} | Aadhaar: ${rawAadhaar} | Results: ${results.length} | Status: ${response.status}`);
    
    res.status(200).json(jsonResponse);
    
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch data from source', 
      details: error.message,
      suggestion: 'Try again later or check if the Aadhaar number is correct'
    });
  }
}

/**
 * Parse human-readable lookup result into structured JSON
 * @param {string} text - Raw text response from target API
 * @param {string} searchedAadhaar - The Aadhaar number that was queried
 * @returns {Array} Array of result objects
 */
function parseLookupResults(text, searchedAadhaar) {
  const results = [];
  
  // If text is empty or too short, return empty array
  if (!text || text.length < 50) {
    return results;
  }
  
  // Split into sections by "📌 Additional Result:" or main result
  let sections = [];
  if (text.includes('📌 Additional Result:')) {
    const parts = text.split(/📌 Additional Result:/);
    sections.push(parts[0]); // main result
    sections.push(...parts.slice(1)); // additional results
  } else {
    sections = [text];
  }
  
  for (let section of sections) {
    if (!section.trim() || section.trim().length < 20) continue;
    
    // Extract fields using regex patterns
    const nameMatch = section.match(/👤\s*Name:\s*([^\n]+)/);
    const fatherMatch = section.match(/👨‍👦\s*Father Name:\s*([^\n]+)/);
    const mobileMatch = section.match(/📱\s*Mobile:\s*([^\n]+)/);
    const addressMatch = section.match(/🏠\s*Address:\s*([^\n]+(?:\n\s*[^📱👨‍👦👤📡📞🪪]+)*)/);
    const circleMatch = section.match(/📡\s*Circle:\s*([^\n]+)/);
    const alternateMatch = section.match(/📞\s*Alternate:\s*([^\n]+)/);
    const aadhaarMatch = section.match(/🪪\s*Aadhaar:\s*([^\n]+)/);
    
    // Clean up address (remove extra newlines and spaces)
    let address = addressMatch ? addressMatch[1].trim().replace(/\s+/g, ' ') : null;
    let mobile = mobileMatch ? mobileMatch[1].trim() : null;
    
    // Determine ID field (prefer Aadhaar, fallback to alternate number)
    let id = null;
    if (aadhaarMatch) {
      id = aadhaarMatch[1].trim();
    } else if (alternateMatch) {
      id = alternateMatch[1].trim();
    }
    
    // Build result object matching the required schema
    const resultObj = {
      address: address || null,
      email: null,  // Email not available in this data source
      fname: fatherMatch ? fatherMatch[1].trim() : null,
      id: id,
      mobile: mobile,
      name: nameMatch ? nameMatch[1].trim() : null,
      // Additional fields (extra info that may be useful)
      circle: circleMatch ? circleMatch[1].trim() : null,
      alternate: alternateMatch ? alternateMatch[1].trim() : null
    };
    
    // Only add if at least name, mobile, or id exists
    if (resultObj.name || resultObj.mobile || resultObj.id) {
      results.push(resultObj);
    }
  }
  
  // Deduplicate results by mobile number or Aadhaar ID
  const seen = new Set();
  const uniqueResults = results.filter(r => {
    const key = r.mobile || r.id;
    if (key && seen.has(key)) return false;
    if (key) seen.add(key);
    return true;
  });
  
  return uniqueResults;
}
