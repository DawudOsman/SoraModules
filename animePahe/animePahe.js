// DDOS BYPASS CLASS
class DdosGuardInterceptor {
  constructor() {
      this.errorCodes = [403]; // Blocked by DDoS-Guard
      this.serverCheck = ["ddos-guard"]; // Server header check
      this.cookieStore = {}; // In-memory cookie storage
  }

  async fetchWithBypass(url, options = {}) {
      let response = await this.fetchWithCookies(url, options);

      // If request is successful or not blocked, return response
      if (!this.errorCodes.includes(response.status) || !this.isDdosGuard(response)) {
          return response;
      }

      console.error("DDoS-Guard detected, attempting to bypass...");

      // Check if we already have the __ddg2_ cookie
      if (this.cookieStore["__ddg2_"]) {
          console.error("Retrying request with existing DDoS-Guard cookie...");
          return this.fetchWithCookies(url, options);
      }

      // Get a new DDoS-Guard cookie
      const newCookie = await this.getNewCookie(url);
      if (!newCookie) {
          console.error("Failed to retrieve DDoS-Guard cookie.");
          return response;
      }

      console.error("New DDoS-Guard cookie acquired, retrying request...");
    
      return this.fetchWithCookies(url, options);
  }

  async fetchWithCookies(url, options) {
      const cookieHeader = this.getCookieHeader();
      const headers = { ...options.headers, Cookie: cookieHeader };

      const response = await fetchv2(url,  headers );

      // Store any new cookies received
      const setCookieHeader = response.headers["Set-Cookie"];
      if (setCookieHeader) {
          this.storeCookies(setCookieHeader);
      }

      return response;
  }

  isDdosGuard(response) {
      const serverHeader = response.headers["Server"];
      return serverHeader && this.serverCheck.includes(serverHeader.toLowerCase());
  }

  storeCookies(setCookieString) {
      setCookieString.split(";").forEach(cookieStr => {
          const [key, value] = cookieStr.split("=");
          this.cookieStore[key.trim()] = value?.trim() || "";
      });
  }

  getCookieHeader() {
      return Object.entries(this.cookieStore)
          .map(([key, value]) => `${key}=${value}`)
          .join("; ");
  }

  async getNewCookie(targetUrl) {
      try {
          // Fetch the challenge path from DDoS-Guard
          const wellKnownResponse = await fetchv2("https://check.ddos-guard.net/check.js");
          const wellKnownText = await wellKnownResponse.text();

          const wellKnownPath = wellKnownText.split("'")[1];
            const regex = /^(https?:\/\/[^\/]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/;
            var newUrl = targetUrl.replace(regex, (match, baseUrl, pathname, query, fragment) => {
                // If pathname exists, replace it; otherwise, just append the newPath
                return `${baseUrl}${wellKnownPath}${query || ''}${fragment || ''}`;
            });
          // Make a request to the challenge URL
          const checkResponse = await this.fetchWithCookies(newUrl, {});
          const setCookieHeader = checkResponse.headers["Set-Cookie"];

          if (!setCookieHeader) return null;

          // Store and return the new DDoS-Guard cookie
          this.storeCookies(setCookieHeader);
          return this.cookieStore["__ddg2_"];
      } catch (error) {
          console.error("Error fetching DDoS-Guard cookies:");
        console.error(error.message)
          return null;
      }
  }
}



// TEMPLATE TODO - Fill in the following variables
const BASE_URL = 'https://www.animepahe.ru';
const SEARCH_URL = 'https://www.animepahe.ru/api';
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/16.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
];
/**
* Searches the website for anime with the given keyword and returns the results
* @param {string} keyword The keyword to search for
* @returns {Promise<string>} A promise that resolves with a JSON string containing the search results in the format: `[{"title": "Title", "image": "Image URL", "href": "URL"}, ...]`
*/
async function searchResults(keyword) {
  
  try {
      // TEMPLATE TODO
      // Either find the page url for the search page, fetch it, match it with regex and return the results
      // Or if you're lucky and the site has a search API return JSON use that instead
  console.error('beforeFetch');
      const response = await fetchv2(`${ SEARCH_URL }/?m=search&q=${ encodeURIComponent(keyword) }`);

      //const html = typeof response === 'object' ? await response.text() : await response; // Website response (Pick only one, both will give an error)


      const data =  response; // API response (Pick only one, both will give an error)
    const body = await JSON.parse(data['_data']);

      const formatted_response = body['data'].map((x)=>{return {title:x['title'],image:x['poster'],href:`${x['session']}`}})
      return JSON.stringify(formatted_response);
  } catch (error) {
      console.error(error);
      return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
  }
}

/**
* Extracts the details (description, aliases, airdate) from the given url
* @param {string} url The url to extract the details from
* @returns {Promise<string>} A promise that resolves with a JSON string containing the details in the format: `[{"description": "Description", "aliases": "Aliases", "airdate": "Airdate"}]`
*/
async function extractDetails(url) {
  try {
      // TEMPLATE TODO
      // Fetch the provided url, match it with regex and return the details
      // Or if you're lucky and the site has an API return JSON use that instead
      const DETAILS_URL = `${BASE_URL}/anime/${url}`
      const pattern = /<div[^>]*class=["']anime-synopsis["'][^>]*>(.*?)<\/div>/is
      // initialize DDOS bypass
      const ddosInterceptor = new DdosGuardInterceptor();
      // fetch response at most 10 times to bypass ddos check 
      const response =    await ddosInterceptor.fetchWithBypass(DETAILS_URL);

      const html = await response['_data']
      const description = extract_text_from_html(html,pattern)
      // Website response (Pick only one, both will give an error)
      // const data = typeof response === 'object' ? await response.json() : await JSON.parse(response); // API response (Pick only one, both will give an error)
      details = {description:description,aliases:'N/A',airdate:'N/A'}
      return JSON.stringify([details]);

  } catch (error) {
      console.error('Details error:', error);
      return JSON.stringify([{
          description: 'Error loading description',
          aliases: 'Duration: Unknown',
          airdate: 'Aired: Unknown'
      }]);
  }
}

/**
* Extracts the episodes from the given url.
* @param {string} url - The url to extract the episodes from.
* @returns {Promise<string>} A promise that resolves with a JSON string containing the episodes in the format: `[{ "href": "Episode URL", "number": Episode Number }, ...]`.
* If an error occurs during the fetch operation, an empty array is returned in JSON format.
*/
async function extractEpisodes(url) {
  try {
      // TEMPLATE TODO
      // Fetch the provided url, match it with regex and return the episodes
      // Or if you're lucky and the site has an API return JSON use that instead
      //const response = await fetchv2(url);
      //const html = typeof response === 'object' ? await response.text() : await response; // Website response (Pick only one, both will give an error)
      // const data = typeof response === 'object' ? await response.json() : await JSON.parse(response); // API response (Pick only one, both will give an error)
      episodes = await extract_episodets_iter(url)

      return JSON.stringify(episodes);
  } catch (error) {
      console.error('Fetch error:', error);
      return JSON.stringify([]);
  }
}

/**
* Extracts the stream URL from the given url.
* @param {string} url - The url to extract the stream URL from.
* @returns {Promise<string|null>} A promise that resolves with the stream URL if successful, or null if an error occurs during the fetch operation.
*/
async function extractStreamUrl(url) {
  try {
      // TEMPLATE TODO
      // Fetch the provided url, match it with regex and return the stream URL
      // Or get the iframe through regex, fetch the iframe, match it with regex and return the stream URL
      // Or if you're lucky and the site has an API return JSON use that instead
     // console.error("WEB EPISODE URL IS")
      //console.error(url)
      //const paheWinLink = await getPaheWinLink(url);
     // console.error("PAHE URL IS")
      //console.error(paheWinLink)
      //const redirectUrl = await getRedirectUrl(paheWinLink+"/i");
     // console.error("REDIRECT URL IS")
      //console.error(redirectUrl)
      //const streamUrl = await fetchDownloadLink(redirectUrl)
      // const html = typeof response === 'object' ? await response.text() : await response; // Website response (Pick only one, both will give an error)
      // const data = typeof response === 'object' ? await response.json() : await JSON.parse(response); // API response (Pick only one, both will give an error)
      //console.error("STREAM URL IS")
      //console.error(streamUrl)
    const hlsPaheLink = await getHLSPaheLink(url);
    //console.error("HLS PAHE LINK IS")
     //console.error(hlsPaheLink)
    const hlsUrl = await Promise.all(hlsPaheLink.map(async x=>{
            
        const hlsLink = await getHLSLink(x)
        return "https://proxy.vumeto.com/fetch?url="+hlsLink

    }))

    
      return JSON.stringify({streams:hlsUrl,subtitles:""});
    //const newStreamUrl = streamUrl.replace('.mp4', '.m3u8')
    //return newStreamUrl
    

  } catch (error) {
      console.error('Fetch error:');
      console.error(error)
      return null;
  }
}

/**
* NOTE: Used to trim giant html strings if regex is too slow
* 
* Trims around the content, leaving only the area between the start and end string
* @param {string} text The text to trim
* @param {string} startString The string to start at (inclusive)
* @param {string} endString The string to end at (exclusive)
* @returns The trimmed text
*/
function trimText(text, startString, endString) {
  const startIndex = text.indexOf(startString);
  const endIndex = text.indexOf(endString, startIndex);
  return text.substring(startIndex, endIndex);
}

/**
* NOTE: Used to remove data that would otherwise get captured by your regex
* 
* Cuts out the content between start and end string and returns the surrounding text
* @param {string} text The text to cut from
* @param {string} startString The string to cut from (inclusive)
* @param {string} endString The string to cut to (exclusive)
* @returns The cut text
*/
function cutText(text, startString, endString) {
  const startIndex = text.indexOf(startString);
  const endIndex = text.indexOf(endString, startIndex);

  // Nothing to cut out
  if(startIndex <= 0) return text;

  const startContent = text.substring(0, startIndex);
  const endContent = text.substring(endIndex);

  let tmpContent = startContent + endContent;

  return tmpContent;
}

/**
* NOTE: Used only when the p.a.c.k.e.r. algorithm is used on your source, remove if this is not the case
* 
* Extracts and deobfuscates an obfuscated script from the given HTML content.
* @param {string} html - The HTML content containing the obfuscated script.
* @returns {string|null} The deobfuscated script, or null if no obfuscated script is found.
*/
function deobfuscate(html) {
  const obfuscatedScript = html.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
  const unpackedScript = unpack(obfuscatedScript[1]);
  return unpackedScript;
}

/*
* NOTE: Used only when the p.a.c.k.e.r. algorithm is used on your source, remove if this is not the case
*
* DEOBFUSCATOR CODE
*/
class Unbaser {
  constructor(base) {
      this.ALPHABET = {
          62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
          95: "' !\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
      };
      this.dictionary = {};
      this.base = base;
      if (36 < base && base < 62) {
          this.ALPHABET[base] = this.ALPHABET[base] ||
              this.ALPHABET[62].substr(0, base);
      }
      if (2 <= base && base <= 36) {
          this.unbase = (value) => parseInt(value, base);
      }
      else {
          try {
              [...this.ALPHABET[base]].forEach((cipher, index) => {
                  this.dictionary[cipher] = index;
              });
          }
          catch (er) {
              throw Error("Unsupported base encoding.");
          }
          this.unbase = this._dictunbaser;
      }
  }
  _dictunbaser(value) {
      let ret = 0;
      [...value].reverse().forEach((cipher, index) => {
          ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
      });
      return ret;
  }
}

/**
* NOTE: Used only when the p.a.c.k.e.r. algorithm is used on your source, remove if this is not the case
* 
* Checks if a given source code (JS File) is obfuscated with the p.a.c.k.e.r. algorithm.
* @param {string} source - The source code (JS File) to check.
* @returns {boolean} true if the source code is obfuscated with p.a.c.k.e.r., false otherwise.
*/
function detect(source) {
  return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}

/**
* NOTE: Used only when the p.a.c.k.e.r. algorithm is used on your source, remove if this is not the case
* 
* Unpacks a given source code (JS File) that is obfuscated with the p.a.c.k.e.r. algorithm.
* @param {string} source - The source code (JS File) to unpack.
* @returns {string} The unpacked source code.
* @throws {Error} If the source code is not obfuscated with p.a.c.k.e.r. or if the data is corrupted.
*/
function unpack(source) {
  let { payload, symtab, radix, count } = _filterargs(source);
  if (count != symtab.length) {
      throw Error("Malformed p.a.c.k.e.r. symtab.");
  }
  let unbase;
  try {
      unbase = new Unbaser(radix);
  }
  catch (e) {
      throw Error("Unknown p.a.c.k.e.r. encoding.");
  }
  function lookup(match) {
      const word = match;
      let word2;
      if (radix == 1) {
          word2 = symtab[parseInt(word)];
      }
      else {
          word2 = symtab[unbase.unbase(word)];
      }
      return word2 || word;
  }
  source = payload.replace(/\b\w+\b/g, lookup);
  return _replacestrings(source);
  function _filterargs(source) {
      const juicers = [
          /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
          /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
      ];
      for (const juicer of juicers) {
          const args = juicer.exec(source);
          if (args) {
              let a = args;
              if (a[2] == "[]") {
              }
              try {
                  return {
                      payload: a[1],
                      symtab: a[4].split("|"),
                      radix: parseInt(a[2]),
                      count: parseInt(a[3]),
                  };
              }
              catch (ValueError) {
                  throw Error("Corrupted p.a.c.k.e.r. data.");
              }
          }
      }
      throw Error("Could not make sense of p.a.c.k.e.r data (unexpected code structure)");
  }
  function _replacestrings(source) {
      return source;
  }
}
/** 
* Util Functions
**/
// decrypt functions that I dont know how it works but works
function getString(content, s1, s2) {
  let slice2 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/".slice(0, s2);
  let acc = 0;
  
  for (let n = 0; n < content.length; n++) {
      let i = parseInt(content[content.length - 1 - n], 10) || 0;// Reverse the string by accessing from the end
      acc += i * s1 ** n;
  }
  
  let k = "";
  
  while (acc > 0) { 
      k = slice2[Number(acc % s2)] + k; 
      acc = (acc - (acc % s2)) / s2; 
  }
  
  return k || "0";
}

function decrypt(fullString, key, v1, v2) {
  v1 = parseInt(v1, 10);
  v2 = parseInt(v2, 10);
  let r = "";
  let i = 0;
  
  while (i < fullString.length) {
      let s = "";
      while (fullString[i] !== key[v2]) {
          s += fullString[i];
          i++;
      }
      
      for (let j = 0; j < key.length; j++) {
          s = s.split(key[j]).join(j.toString());
      }
      
      r += String.fromCharCode(parseInt(getString(s, v2, 10)) - v1);
      i++;
  }
  
  return r;
}
// get Redirect Url from paheWinLink
async function getRedirectUrl(url) {
  const response = await fetchv2(url,
      {
          "Referer": "https://kwik.cx/" // Add the Referer header
      },
       'GET',
      undefined,
      false // Prevent automatic redirects
  );

  if (response.status >= 300 && response.status < 400) {
      const newUrl = response.headers['Location']
      const index = newUrl.lastIndexOf("https://");
      const result = newUrl.slice(index + "https://".length);
      return result; // Extract redirect URL
  }
  return url; // If no redirect, return original URL
}
// gets StreamURL
async function fetchDownloadLink(downloadPageLink) {
  if (!downloadPageLink.startsWith("http")) {
      downloadPageLink = "https://" + downloadPageLink;
  }

  // First request to get download page HTML
  const pageResponse = await fetchv2(downloadPageLink,
      { 
           // Mimic Python
          "Referer": "https://kwik.cx/"
      },
       "GET"
  );

  const downloadPage = await pageResponse.text();


  // Extract keys using regex
  const match = downloadPage.match(/\("(\w+)",\d+,"(\w+)",(\d+),(\d+),\d+\)/);

  if (!match) throw new Error("Failed to extract decryption parameters");

  const [_, full_key, key, v1, v2] = match;

  // Perform decryption
  const decrypted = decrypt(full_key, key, v1, v2);

  const actionMatch = decrypted.match(/action="(.+?)"/);
  const tokenMatch = decrypted.match(/value="(.+?)"/);
  if (!actionMatch || !tokenMatch) throw new Error("Failed to extract form action or token");

  const actionUrl = actionMatch[1];
  const token = tokenMatch[1];

  // Second request to submit form with extracted token
  const contentResponse = await fetchv2(actionUrl,
      {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://kwik.cx/',
          
          'Cookie': pageResponse.headers["Set-Cookie"].replace("path=/;", ""),
          'X-CSRF-TOKEN': `${token}`
      },
       'POST',
      `ss`,
       false // Prevent auto-redirect
  );

  const location = contentResponse.headers["Location"];

  return location;
}
// get PaheWinLink
async function getPaheWinLink(url) {
  const regex = /<a\s+href=["'](https:\/\/pahe\.win\/[^\s'"]+)["'][^>]*\s+target=["']_blank["'][^>]*\s+class=["'][^"']*dropdown-item[^"']*["'][^>]*>.*?<\/a>/i
;
  const ddosInterceptor = new DdosGuardInterceptor();
  const r = await ddosInterceptor.fetchWithBypass(url);
  const text = await r.text()
  const match = text.match(regex)
  // check regexMatch output
  //console.error(match[1])
  return match[1]
}
// iteratively extract episodes
async function extract_episodets_iter(url)
{
  var end_loop = false
  var pageNo = 1
  var episodes = []
  var EXTRACT_URL = `${SEARCH_URL}?m=release&id=${url}&sort=episode_asc&page=${pageNo}`
  var EPISODE_URL = `${BASE_URL}/play/${url}/`
  const ddosInterceptor = new DdosGuardInterceptor();
  while (!end_loop)
      {
          const r =    await ddosInterceptor.fetchWithBypass(EXTRACT_URL);
          data = await JSON.parse(r['_data'])
          if('data' in data)
              {
                  for (let i = 0; i < data['data'].length; i++) {
                      episodes.push({href:`${EPISODE_URL}${data['data'][i]['session']}`,number:data['data'][i]['episode']})
                    }
              }
          if('next_page_url' in data)
              {
                  if(data['next_page_url'] === null)
                      {
                          end_loop = true
                      }
                  else
                  {
                      pageNo = pageNo + 1 
                      EXTRACT_URL = `${SEARCH_URL}?m=release&id=${url}&sort=episode_asc&page=${pageNo}`
                  }
              }
          else
          {
              end_loop = true
          }
      }
  return episodes
}
// extract text from html with provided regex
function extract_text_from_html(html_content,pattern)
{
  extracted_text = html_content.match(pattern)
  var formatted_text = extracted_text[1].trim();
  //remove br elements
  formatted_text = formatted_text.replace(/<br\s*\/?>/gi, " ")
  formatted_text = formatted_text.replace(/\s+/g, " ")
  return formatted_text
}
//HLS FUNC
async function getHLSPaheLink(url)
{
    parentDivRegex = /<div[^>]*id="resolutionMenu"[^>]*>([\s\S]*?)<\/div>/
    childRegex = /data-src="([^"]+)"/g
    const ddosInterceptor = new DdosGuardInterceptor();
    const r = await ddosInterceptor.fetchWithBypass(url);

    const text = await r.text()
    const parentMatch = text.match(parentDivRegex)[1]
    const childMatch = [...parentMatch.matchAll(childRegex)];
    return childMatch.map(x=>x[1])
}

async function getHLSLink(videoUrl)
{
    try {
        const response = await fetchv2(videoUrl, 
            { 'Referer': "https://animepahe.ru/" }
        );
  
        const data = await response.text();

        const match = /(eval)(\(f.*?)(\n<\/script>)/s.exec(data);
        if (!match || match.length < 3) {
            console.error("No matching eval script found.");
            return null;
        }

        const source = eval(match[2].replace('eval', '')).match(/https.*?m3u8/);
        
        if (!source) {
            console.error("No M3U8 URL found.");
            return null;
        }

        return source[0];
        
    } catch (error) {
        console.error("Error fetching video:");
        return null;
    }
}
/** 
* Tests
**/
