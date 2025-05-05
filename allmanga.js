const apiUrl = "https://api.allanime.day/api"
const baseUrl = "https://allmanga.to"
const DEFAULT_HEADERS =  {
  "Content-Type": "application/json",
};
// GRAPHQL QUERIES
const SEARCH_QUERY = `query($search: SearchInput,$limit: Int,$countryOrigin: VaildCountryOriginEnumType,$page: Int) {shows(search: $search,limit: $limit,countryOrigin: $countryOrigin,page: $page){edges{_id name nativeName englishName thumbnail slugTime } } } `;
const DETAIL_EPISODE_QUERY = `query($id: String!) {show(_id: $id) {thumbnail description type season score genres status studios availableEpisodesDetail } } `;
const STREAM_QUERY =  `query($showId: String! $episodeString: String!  $translationType: VaildTranslationTypeEnumType!) {  episode(    showId: $showId    episodeString: $episodeString    translationType: $translationType  ) {    sourceUrls  }}`;
async function searchResults(keyword) {
    try {

    const variable = {
      "search": {
        "query": keyword, 
        "allowAdult": false,
        "allowUnknown": false
      },
      "countryOrigin": "ALL",
      "limit": 26,
      "page": 1
    };
    console.log(JSON.stringify({ "query":SEARCH_QUERY,"variables": variable }))
    const response = await fetch(`${apiUrl}`,
      {method:"POST",
        body:JSON.stringify({ "query":SEARCH_QUERY,"variables": variable }),
        headers: DEFAULT_HEADERS
      })
      console.log(response)
        const data = await response.json();
        console.log(data)
        const resList = data.data.shows.edges    
        const transformedResults = resList.map(anime => ({
            title: anime.englishName,
            image: anime.thumbnail,
            href: anime._id
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(id) {
    try {


    const variable = {id:id}
        const response = await fetch(`${apiUrl}`,
          {method:"POST",
            body:JSON.stringify({ query:DETAIL_EPISODE_QUERY,variables: variable }),
            headers: DEFAULT_HEADERS
          })
        const data = await response.json();
        const anime = data.data.show
        console.log(anime.availableEpisodesDetail.sub)
        const transformedResults = {
            description: htmlToText(anime.description).replace(/\n+/g, '\n ')|| 'No description available',
            aliases: `Duration: ${'Unknown'}`,
            airdate: `Aired: ${anime.season.year || 'Unknown'}`
        };
        
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
        description: 'Error loading description',
        aliases: 'Duration: Unknown',
        airdate: 'Aired: Unknown'
        }]);
  }
}

async function extractEpisodes(id) {
    try {


    const variable = {id:id}
        const response = await fetch(`${apiUrl}`,
          {method:"POST",
            body:JSON.stringify({ query:DETAIL_EPISODE_QUERY,variables: variable }),
            headers: DEFAULT_HEADERS
          })
        const data = await response.json();
        const anime = data.data.show
        console.log(anime)
        const transformedResults = anime.availableEpisodesDetail.sub.map(episode => ({
            href: JSON.stringify({showId:id,translationType:"sub",episodeString:episode}),
            number: episode
        }));
        
        return JSON.stringify(transformedResults.reverse());
        
    } catch (error) {
        console.log('Fetch error:', error);
    }    
}

async function extractStreamUrl(url) {
    try {
        const variable = JSON.parse(url)
        const response = await fetch(`${apiUrl}`,
            {method:"POST",
              body:JSON.stringify({ query:STREAM_QUERY,variables: variable }),
              headers: DEFAULT_HEADERS
            })
        const data = await response.json();
       //console.log(data.data.episode.sourceUrls)
       const mp4Val = data.data.episode.sourceUrls.filter(x=> x.sourceName == "Mp4")
       const defaultVal = data.data.episode.sourceUrls.filter(x=> x.sourceName == "Default")
       const YtVal = data.data.episode.sourceUrls.filter(x=> x.sourceName == "Yt-mp4")
       const AkVal = data.data.episode.sourceUrls.filter(x=> x.sourceName == "Ak")
       const LufMp4 = data.data.episode.sourceUrls.filter(x=> x.sourceName == "Luf-Mp4")
       const SMP4 = data.data.episode.sourceUrls.filter(x=> x.sourceName == "Luf-Mp4")
       const decrpytedSources = data.data.episode.sourceUrls.map(x=>{ return {sourceName:x.sourceName,sourceUrl:decryptSource(x.sourceUrl),type:x.type}})
       console.log(decrpytedSources)
       var streams = []
       for (const source of decrpytedSources)
        {
          try
          {
            console.log(source.sourceName)
            switch(source.sourceName)
            {
              case "Sw":
                {
                  const streamUrl = await streamWishExtractor(source.sourceUrl)
                  streams.push([source.sourceName,streamUrl,source.type])
                  break
                }
              case "Fm-Hls":{
                const streamUrl = await filemoonExtractor(source.sourceUrl)
                streams.push([source.sourceName,streamUrl,source.type])
                break}
              case "Sl-mp4":{
                console.log("hi")
                const streamUrl = await streamlareExtractor(source.sourceUrl)
                break}
              case "Ok":{
                const streamUrl = await okruExtractor(source.sourceUrl)
                if(streamUrl){streams.push([source.sourceName,streamUrl,source.type])}
                
                break
              }
              case "Mp4":{
                const streamUrl = await mp4Extractor(source.sourceUrl)
                streams.push([source.sourceName,streamUrl,source.type])
                break;
              };
              case "Default":
                {
                  const streamUrl = await defaultExtractor(source.sourceUrl.replace("/clock?", "/clock.json?"))
                  console.log("stream is")
                  console.log(streamUrl)
                  streams.push([source.sourceName,streamUrl,source.type])
                  break
                }
              default:
                {
                  break
                }
            }
          }
          catch (e){
            console.log("error at ")
            console.log(e.message)
          }
        }
       console.log("formatted is")
       console.log(streams)
       if(YtVal.length > 0)
        {
          const decrpytedUrl = decryptSource(YtVal[0].sourceUrl)
          const res = await fetch(decrpytedUrl,{headers:{"Referer":baseUrl,"Accept":"video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5"}})
          //console.log("YT val is")
          const text = res
          //console.log(text)
          streams.push(("Yt mp4",decrpytedUrl))
  
        }
        return streams
    } catch (error) {
       console.log('Fetch error:', error);
       return null;
    }
}
/*
 * DEOBFUSCATOR CODE
 * 
 * Copy the below code fully and paste it in your
 * code. No need to modify anything.
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

function detect(source) {
  return source.replace(" ", "").startsWith("eval(function(p,a,c,k,e,");
}

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
//util functions
// decrpyt sourceUrl
function decryptSource(str) {
  if (str.startsWith("-")) {
      return str.substring(str.lastIndexOf('-') + 1)
          .match(/.{1,2}/g)
          .map(hex => parseInt(hex, 16))
          .map(byte => String.fromCharCode(byte ^ 56))
          .join("");
  } else {
      return str;
  }
}
function htmlToText(htmlText)
{
    let text = htmlText.replace(/<br\s*\/?>/gi, '\n');
// Decode HTML entities
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#x2014;': '—',
    '&#x2019;': '’',
    '&#x201c;': '“',
    '&#x201d;': '”',
    // Add more as needed
  };
  text = text.replace(/&#x[0-9a-fA-F]+;|&[a-z]+;/g, match => {
    if (entities[match]) return entities[match];

    // Handle numeric hex entities like &#x2014;
    if (/^&#x/.test(match)) {
      const code = parseInt(match.replace(/[&#x;]/g, ''), 16);
      return String.fromCharCode(code);
    }

    return match; // Unknown entity, leave as is
  });

  // Optionally remove any other HTML tags
  text = text.replace(/<[^>]*>/g, '');

  return text;
}
// extract URL based on sources
// streamWish extractor
async function streamWishExtractor(url)
{
  const response = await fetch(url)
  const text = await response.text()
  const unpacked = unpack(text)
  const m3u8Regex = /https?:\/\/[^\s]+master\.m3u8[^\s]*?(\?[^"]*)?/;
  const match = unpacked.match(m3u8Regex);
  if(match)
    {
      console.log(match[0])
      return match[0]
    }
}
// filemoon util funcs

function extractFileMoonScript(html) {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1];
    if (content.includes('eval') && content.includes('m3u8')) {
      return content;
    }
  }
  return null;
}
function extractIframeSrc(html) {
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/i;
  const match = html.match(iframeRegex);
  return match ? match[1] : null;
}
// filemoon extractor
async function filemoonExtractor(streamUrl) {
  const url = new URL(streamUrl)
  const fileMoonheaders = {
  }
  const response = await fetch(streamUrl,{headers:fileMoonheaders})
  const text = await response.text()
  //console.log("filemoon text is")
  const script = extractFileMoonScript(text)
  if(script){return script}
  const newUrl = extractIframeSrc(text)
  const newResponse = await fetch(newUrl)
  const newText = await newResponse.text()
  const newScript = extractFileMoonScript(newText)
  //console.log(newScript)
  const newStreamUrl = unpack(newScript);
  const m3u8Regex = /https?:\/\/[^\s]+master\.m3u8[^\s]*?(\?[^"]*)?/;
  const match = newStreamUrl.match(m3u8Regex);
  if(match)
    {
      console.log(match[0])
      return match[0]
    }

}
// streamlare extractor
async function streamlareExtractor(url) {
  const id =  url.split('/').pop();
  console.log(id)
  console.log("before fetch")
  const response = await fetch("https://slwatch.co/api/video/stream/get",
    {
      method: "POST",
      headers: {'Content-Type': 'application/json',
        "User-Agent": "Mozilla/5.0 (Node.js)",
        "Referer": "https://streamlare.com",
        "Origin": "https://streamlare.com",
        
        
      },
      body: `{"id":"${id}"}`,
      credentials: 'include' 
    });
    console.log("cookies area")
    console.log(response.headers)
    const text = await response.text()
    console.log("TEXT IS")
    console.log(text)
  return response
  
}
// OKRU extractor
async function okruExtractor(url) {
  const response = await fetch(url)
  const body = await response.text()
  const match = body.match(/data-options="([^"]*)"/);
  if(match)
    {
      const json = JSON.parse(match[1].replace(/&quot;/g, '"'))
      console.log("okru json is")
      try
      {
        const metaData = JSON.parse(json["flashvars"]["metadata"])
        console.log("metadata json is")
        console.log(metaData)
        console.log(metaData['hlsManifestUrl'])
        if(metaData['hlsManifestUrl'])
          {
            return metaData['hlsManifestUrl']
          }
        
        return metaData["ondemandHls"]

      }
      catch
      {
        console.log("json parse error")
      }

    }
  console.log("okru text is")


  
}
// Default Player extractor
async function defaultExtractor(url) {
  var res = await fetch(`${baseUrl}/getVersion`)
  var data = await res.json()
  const endPoint = data.episodeIframeHead
  res = await fetch(`${endPoint+url}`,{headers:{"Referer":baseUrl}})
  data = await res.json()
  console.log(data.links[0].rawUrls)
  //console.log(data.links[0].rawUrls.vids)
  return data.links[0].link

}
// MP4 EXTRACTOR
async function mp4Extractor(url) {
  const Referer = "https://mp4upload.com"
  const headers = {"Referer":Referer}
  const response = await fetch(url,{headers:headers})
  const htmlText = await response.text()
  console
  const streamUrl = extractMp4Script(htmlText)
  return streamUrl
}
function extractMp4Script(htmlText)
{
  const scripts = extractScriptTags(htmlText);
  let scriptContent = null;


  scriptContent = scripts.find(script =>
      script.includes('eval')
  );

  scriptContent = scripts.find(script => script.includes('player.src'));

  return scriptContent
  .split(".src(")[1]
  .split(")")[0]
  .split("src:")[1]
  .split('"')[1] || '';
}
// Extract all <script>...</script> blocks
function extractScriptTags(html) {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
      scripts.push(match[1].trim());
  }

  return scripts;
}


// Tests
// Tests
searchResults("bleach: thousand-year blood war - the conflict").then((x)=>
  {
    const y= JSON.parse(x)
    extractEpisodes(y[0].href).then((z)=>
      {
        const w = JSON.parse(z)
        extractStreamUrl(w[3].href).then(console.log)
      }
  )
  }
  )
  
  // claude unpacker 
  function unpackJavaScript(packedCode) {
    // This function safely unpacks code without executing it
    // It works by extracting the packer parameters and applying the unpacking algorithm
    function unpackerLogic(p, a, c, k, e, d) {
      e = function(c) {
        return (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
      };
      
      if (!''.replace(/^/, String)) {
        while (c--) {
          d[e(c)] = k[c] || e(c);
        }
        k = [function(e) {
          return d[e];
        }];
        e = function() {
          return '\\w+';
        };
        c = 1;
      }
      
      while (c--) {
        if (k[c]) {
          p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c]);
        }
      }
      
      return p;
    }
  
    // Extract the parameters from the end of the packed code
    const paramRegex = /\(('.*?'),(\d+),(\d+),'(.*?)'\)/;
    const match = packedCode.match(paramRegex);
    
    if (!match) {
      return "Failed to extract parameters from the packed code";
    }
    
    // Extract the packing parameters
    let [_, p, a, c, k] = match;
    
    // Remove escape characters from the string
    p = p.replace(/\\'/g, "'");
    
    // Apply the unpacking algorithm
    return unpackerLogic(p, parseInt(a, 10), parseInt(c, 10), k.split('|'), 0, {});
  }