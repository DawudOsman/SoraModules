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
            switch(source.sourceName)
            {
              case "Mp4":{
                const streamUrl = await mp4Extractor(source.sourceUrl)
                streams.push([source.sourceName,streamUrl,source.type])
                break;
              };
              default:
                {
                  const streamUrl = await defaultExtractor(source.sourceUrl.replace("/clock?", "/clock.json?"))
                  const res = await fetch(source.sourceUrl)
                  streams.push([source.sourceName,streamUrl,source.type])
                }
            }
          }
          catch (e){
            console.log("error at ")
            console.log(source.sourceName)
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
// Default Player extractor
async function defaultExtractor(url) {
  var res = await fetch(`${baseUrl}/getVersion`)
  var data = await res.json()
  const endPoint = data.episodeIframeHead
  res = await fetch(`${endPoint+url}`,{headers:{"Referer":baseUrl}})
  data = await res.json()
  console.log(data.links[0])
  console.log(data.links[0].rawUrls.vids)
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
searchResults("jjk").then((x)=>
  {
    const y= JSON.parse(x)
    extractEpisodes(y[0].href).then((z)=>
      {
        const w = JSON.parse(z)
        extractStreamUrl(w[0].href).then(console.log)
      }
  )
  }
  )
  