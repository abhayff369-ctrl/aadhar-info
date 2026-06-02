// ============================================================
// AADHAAR LOOKUP API
// Multi-key: abhay1, abhay2, abhay3, abhay4, abhay5
// Input: ?api_key=KEY&exploits=12_digit_aadhaar
// Output: JSON with success, total_results, results, developer
// ============================================================

const VALID_KEYS = ['abhay1', 'abhay2', 'abhay3', 'abhay4', 'abhay5'];

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { exploits, api_key } = req.query;

  // ---------- 1. Multi-Key Authentication ----------
  if (!api_key) {
    return res.status(401).json({ 
      error: 'Missing API key', 
      usage: '?api_key=abhay1&exploits=123456789012',
      valid_keys: VALID_KEYS,
      developer: 'abhay singh'
    });
  }

  if (!VALID_KEYS.includes(api_key)) {
    return res.status(403).json({ 
      error: 'Invalid API key', 
      valid_keys: VALID_KEYS,
      developer: 'abhay singh'
    });
  }

  // ---------- 2. Validate Aadhaar (12 digits) ----------
  if (!exploits) {
    return res.status(400).json({ 
      error: 'Missing Aadhaar number', 
      usage: '?api_key=KEY&exploits=123456789012',
      developer: 'abhay singh'
    });
  }

  const aadhaarRegex = /^\d{12}$/;
  if (!aadhaarRegex.test(exploits)) {
    return res.status(400).json({ 
      error: 'Invalid Aadhaar number. Use 12 digits.',
      developer: 'abhay singh'
    });
  }

  // ---------- 3. Call Target API ----------
  const targetUrl = `https://believes-shore-funny-void.trycloudflare.com/search?q=${exploits}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VercelBot/1.0)',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    // ---------- 4. Parse JSON Response ----------
    const hasError = !data.status || data.count === 0 || !data.results || data.results.length === 0;
    
    let results = [];
    
    if (!hasError && data.results && data.results.length > 0) {
      // Use Map to remove duplicates (by id or mobile)
      const uniqueMap = new Map();
      
      for (const item of data.results) {
        // Create unique key - prioritize id, then mobile, then name+frame
        let uniqueKey;
        if (item.id && item.id !== 'null' && item.id !== 'xxxx-xxxx-5107') {
          uniqueKey = item.id;
        } else if (item.mobile) {
          uniqueKey = item.mobile;
        } else {
          uniqueKey = `${item.name || ''}|${item.frame || ''}`;
        }
        
        // Skip if already seen
        if (uniqueMap.has(uniqueKey)) continue;
        
        // Transform to desired format
        const transformed = {};
        
        if (item.name && item.name.trim()) {
          transformed.name = item.name.trim();
        }
        if (item.frame && item.frame.trim()) {
          transformed.father_name = item.frame.trim();
        }
        if (item.mobile) {
          transformed.mobile = item.mobile;
        }
        if (item.address && item.address.trim()) {
          // Clean address: replace '1' with newlines or spaces
          let cleanAddress = item.address.trim();
          cleanAddress = cleanAddress.replace(/1/g, ', ');
          cleanAddress = cleanAddress.replace(/\s+/g, ' ').trim();
          transformed.address = cleanAddress;
        }
        if (item.circle && item.circle !== 'null') {
          transformed.circle = item.circle;
        }
        if (item.alt && item.alt !== 'null') {
          transformed.alternate_number = item.alt;
        }
        if (item.id && item.id !== 'null' && item.id !== 'xxxx-xxxx-5107') {
          transformed.aadhaar = item.id;
        }
        if (item.email && item.email !== 'null') {
          transformed.email = item.email;
        }
        
        uniqueMap.set(uniqueKey, transformed);
      }
      
      results = Array.from(uniqueMap.values());
    }
    
    // ---------- 5. Prepare Final Response ----------
    const jsonResponse = {
      success: true,
      total_results: results.length,
      results: results,
      developer: "abhay singh",
      queried_aadhaar: exploits,
      timestamp: new Date().toISOString()
    };
    
    if (results.length === 0) {
      jsonResponse.message = "No data found for this Aadhaar number";
    }

    console.log(`[KEY_USED] ${api_key} | Aadhaar: ${exploits} | Results: ${results.length}`);
    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch from target', 
      details: error.message,
      developer: 'abhay singh'
    });
  }
}
