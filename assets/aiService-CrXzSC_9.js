import{a as l,G as S,T as a}from"./settingsService-ONkSpYQX.js";import{l as x}from"./index-DmoY5cYw.js";const k=e=>{const t=l().googleApiKey||void 0;if(!t)throw new g("Google API key is not configured. Please add it in Settings or as an environment variable.");return new S({apiKey:t})},T=async(e,s)=>{try{const r=k(),o=l().model||"gemini-3-flash-preview";return await r.models.generateContent({model:o,contents:e,config:s})}catch(r){console.error("Gemini Service Error:",r);const t=r instanceof Error?r.message:"An unknown error occurred with the Google AI service.";throw t.includes("API key not valid")||t.includes("quota")?new g(t):new Error(t)}},I=async e=>(await T(e)).text,R=async(e,s)=>(await T(e,{responseMimeType:"application/json",responseSchema:s})).text,C=async(e,s)=>(await T({parts:[s,{text:e}]})).text,O=async(e,s)=>{const t={parts:[{text:e},...s]};return(await T(t)).text};class g extends Error{constructor(s){super(s),this.name="ApiLimitError"}}const N=e=>new Promise(s=>setTimeout(s,e)),d=async(e,s,r=!1,t,o,n=3)=>{const i=l(),m=o?"Multimodal/OCR":"Text Generation",p=`REQ-${Math.random().toString(36).substr(2,5).toUpperCase()}`;for(let c=1;c<=n;c++){const A=Date.now();x.info(`[${p}] بدء طلب الذكاء الاصطناعي (المحاولة ${c}/${n})`,`Provider: ${i.provider}, Model: ${s}, Type: ${m}`),console.log(`[AI Service] Starting handleApiCall (Attempt ${c}/${n}). Provider: ${i.provider}, Model: ${i.model}, Action: ${o?"Multimodal/OCR":"Text"}`);try{let u;if(i.provider==="google")console.log("[AI Service] Calling Gemini Service..."),r?u=await R(e,t):o?u=await C(e,o):u=await I(e);else if(["openrouter","mistral"].includes(i.provider)){console.log("[AI Service] Calling Server Data Proxy...");const b="/api/ai",E=[];let h="chat";if(i.provider==="mistral"&&s==="mistral-ocr-latest"&&o&&(h="ocr"),h==="chat")if(o)if(o.inlineData.mimeType.startsWith("image/"))E.push({role:"user",content:[{type:"text",text:e},{type:"image_url",image_url:{url:`data:${o.inlineData.mimeType};base64,${o.inlineData.data}`}}]});else throw new Error(`Provider ${i.provider} does not support direct file analysis for mime type ${o.inlineData.mimeType}.`);else E.push({role:"user",content:e});const y=await fetch(b,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:i.provider,model:i.model,action:h,messages:h==="chat"?E:void 0,fileData:h==="ocr"?o.inlineData.data:void 0,fileMimeType:h==="ocr"?o.inlineData.mimeType:void 0,userApiKey:i.provider==="mistral"?i.mistralApiKey:i.provider==="openrouter"?i.openRouterApiKey:void 0,...r&&{response_format:{type:"json_object"}}})}),w=await y.json();if(!y.ok){const f=w?.error?.message||w?.message||`API Error: ${y.status}`;throw console.error(`[AI Service] Server Proxy Error: ${f}`),y.status===429||y.status===401?new g(f):new Error(f)}if(h==="ocr"){if(!w.pages)throw new Error("استجابة غير صالحة من نموذج OCR.");u=w.pages.map(f=>f.markdown).join(`

`)}else u=w.choices[0].message.content}else throw new Error("Unsupported AI provider.");const $=((Date.now()-A)/1e3).toFixed(2),v=u?.length||0;return x.success(`[${p}] اكتمل الطلب بنجاح`,`Duration: ${$}s, Output Size: ${v} chars`),console.log(`[AI Service] handleApiCall success. Result length: ${u?.length}`),u}catch(u){const $=((Date.now()-A)/1e3).toFixed(2),v=u instanceof Error?u.message:"Unknown error";if(x.error(`[${p}] فشل الطلب (المحاولة ${c})`,`Duration: ${$}s, Error: ${v}`),u instanceof g||c===n)throw c===n?(console.error("AI Service Error:",u),new Error(`خطأ في التواصل مع الذكاء الاصطناعي: ${v}`)):u;console.error(`AI Service Error (Attempt ${c}):`,u);const b=Math.pow(2,c)*1e3;x.info(`[${p}] إعادة المحاولة بعد ${b/1e3} ثوانٍ...`),await N(b)}}},M=(e,s)=>{const r=[];let t=0;for(;t<e.length;){let o=Math.min(t+s,e.length);if(o<e.length){const n=e.lastIndexOf(`

`,o);n>t+s/2&&(o=n)}r.push(e.substring(t,o)),t=o}return r},D=async(e,s,r)=>{const t=l();r?.("جاري إنشاء الملخص...");let o;if(s.startsWith("TEMPLATE:"))o=`${s.replace("TEMPLATE:","")}

Text to process:
${e}`;else switch(s){case"points":o=`Summarize the following text into key bullet points in Arabic:

${e}`;break;case"short":o=`Provide a short, one-paragraph summary of the following text in Arabic:

${e}`;break;case"detailed":o=`Provide an exhaustive and highly detailed summary of the following text in Arabic. Your goal is to create a summary so comprehensive that it could substitute for reading the original document. Capture all key arguments, data, narrative points, and conclusions. Structure the summary logically.

Text:
---
${e}
---`;break;case"simple":o=`Explain the following text in simple Arabic terms, as if for a beginner:

${e}`;break;default:o=`Summarize the following text in Arabic:

${e}`}return(await d(o,t.model)).trim()},q=async(e,s)=>{const r=l();let t;switch(s){case"points":t="This document is a series of images. Summarize its content into key bullet points in Arabic.";break;case"short":t="This document is a series of images. Provide a short, one-paragraph summary of its content in Arabic.";break;case"detailed":t="This document is a series of images. Provide a detailed summary of its content in Arabic, covering all main sections shown.";break;case"simple":t="This document is a series of images. Explain its content in simple Arabic terms, as if for a beginner.";break;default:t="This document is a series of images. Summarize its content in Arabic."}try{if(r.provider==="google")return await O(t,e);if(["openrouter","mistral"].includes(r.provider)){const o="/api/ai",n=[{type:"text",text:t}];e.forEach(c=>{n.push({type:"image_url",image_url:{url:`data:${c.inlineData.mimeType};base64,${c.inlineData.data}`}})});const i=[{role:"user",content:n}],m=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:r.provider,model:r.model,messages:i,userApiKey:r.provider==="mistral"?r.mistralApiKey:r.provider==="openrouter"?r.openRouterApiKey:void 0})}),p=await m.json();if(!m.ok){const c=p?.error?.message||`API Error: ${m.status}`;throw m.status===429||m.status===401?new g(c):new Error(c)}return p.choices[0].message.content.trim()}else throw new Error("Unsupported AI provider.")}catch(o){if(o instanceof g)throw o;console.error("AI Service Error (summarizeImages):",o);const n=o instanceof Error?o.message:"An unknown error occurred.";throw new Error(`An error occurred while communicating with the AI service: ${n}`)}},F=async(e,s)=>{const r=l();if(r.provider!=="google"&&!(r.provider==="mistral"&&r.model==="mistral-ocr-latest"))throw new Error(`مزود الخدمة '${r.provider}' لا يدعم تحليل ملفات PDF مباشرة.`);let t;if(s.startsWith("TEMPLATE:"))t=`This document is a file. Analyze its content (which may be text or images) and follow these instructions:
${s.replace("TEMPLATE:","")}`;else switch(s){case"points":t="This document is a file. Analyze its content (which may be text or images) and summarize it into key bullet points in Arabic.";break;case"short":t="This document is a file. Analyze its content (which may be text or images) and provide a short, one-paragraph summary of it in Arabic.";break;case"detailed":t="This document is a file. Analyze its content (which may be text or images) and provide an exhaustive and highly detailed summary in Arabic. Your goal is to create a summary so comprehensive that it could substitute for reading the original document. Capture all key arguments, data, narrative points, and conclusions. Structure the summary logically.";break;case"simple":t="This document is a file. Analyze its content (which may be text or images) and explain it in simple Arabic terms, as if for a beginner.";break;default:t="This document is a file. Analyze its content (which may be text or images) and summarize it in Arabic."}return(await d(t,r.model,!1,void 0,e)).trim()},j=async(e,s,r,t)=>{const o=l(),n=`Based on the following context, create a quiz in Arabic with exactly ${s} questions.
    Question type should be: ${r}.
    ${t?`Follow these custom instructions: ${t}`:""}
    For multiple-choice questions, provide 4 options.
    Return the response as a JSON object with a single key "quiz" which is an array of question objects.
    Each question object must have "type" ("multiple-choice", "true-false", or "open-ended"), "question", and for multiple-choice, an "options" array of strings.

    Context:
    ---
    ${e}
    ---
    `,i={type:a.OBJECT,properties:{quiz:{type:a.ARRAY,items:{type:a.OBJECT,properties:{type:{type:a.STRING},question:{type:a.STRING},options:{type:a.ARRAY,items:{type:a.STRING}}},required:["type","question"]}}}},m=await d(n,o.model,!0,i);return JSON.parse(m)},G=async(e,s)=>{const r=l(),o=`Correct the following quiz in Arabic based on the questions and user answers.
    Provide the correct answer for each question in Arabic.
    Determine if the user's answer was correct.
    Calculate a final score out of 100.
    Return a JSON object with "score" (a number) and "results" (an array).
    Each item in the results array should have "question", "userAnswer", "correctAnswer", and "isCorrect" (boolean).

    Quiz Data:
    ---
    ${JSON.stringify({questions:e,answers:s})}
    ---
    `,n={type:a.OBJECT,properties:{score:{type:a.NUMBER},results:{type:a.ARRAY,items:{type:a.OBJECT,properties:{question:{type:a.STRING},userAnswer:{type:a.STRING},correctAnswer:{type:a.STRING},isCorrect:{type:a.BOOLEAN}},required:["question","userAnswer","correctAnswer","isCorrect"]}}}},i=await d(o,r.model,!0,n);return JSON.parse(i)},J=async e=>{const s=l();return(await d("Extract all text from this image. Preserve line breaks. Respond in Arabic if the text is Arabic.",s.model,!1,void 0,e)).trim()},K=async(e,s)=>{const r=l();console.log(`[AI Service] extractTextFromPdfChunk called. Provider: ${r.provider}`);const t=s&&s.target;let o=`Extract text from this PDF chunk with high accuracy.
Target Languages: **Arabic & Kurdish**.
Strictly maintain the original structure using Markdown (headings, lists, tables).

**Critical Instructions:**
1. **Kurdish Text:** Write words correctly connected. DO NOT add extra spaces within words (e.g., write "ناوةڕاست" not "ن ا و ة ڕ ا س ت"). Preserve characters like (ێ، ۆ، ڵ، ە، ڕ).
2. **Format:** Use RTL direction. Represent headers with #.
3. **Empty Pages:** If a page is empty/image-only without text, write: \`[صفحة صورة أو فارغة]\`.
4. **Output:** Return ONLY the Markdown text. No introductions.
`;if(t?o+=`
5. **Translation:** Translate the extracted text to ${s.target}.
   - Source: ${s.source==="auto"?"Auto-detect":s.source}.
   - Output ONLY the translated Markdown.
`:o+=`
5. **Output:** Return only the extracted Markdown. No comments.
`,o+="\n6. **Separator:** End each page content with `---PAGEBREAK---`.\n",r.provider!=="google"&&!(r.provider==="mistral"&&r.model==="mistral-ocr-latest")){const n=`[AI Service] Provider ${r.provider} not supported for PDF OCR.`;throw console.error(n),new Error(`مزود الخدمة المختار (${r.provider}) لا يدعم تحليل ملفات PDF مباشرة لاستخراج النصوص. يرجى استخدام Google أو Mistral OCR.`)}try{const n=await d(o,r.model,!1,void 0,e);return console.log(`[AI Service] extractTextFromPdfChunk success. Result preview: ${n.substring(0,50)}...`),n.trim()}catch(n){throw console.error("[AI Service] extractTextFromPdfChunk failed:",n),n}},B=async e=>{const s=l();return(await d("Describe this image from a presentation slide in a concise and informative way, in Arabic.",s.model,!1,void 0,e)).trim()},L=async e=>{const s=l(),r=`Correct any grammatical and spelling errors in the following Arabic text. Return only the corrected text, without any introductory phrases or explanations.
    
    Text:
    ---
    ${e}
    ---
    `;return(await d(r,s.model)).trim()},Y=async(e,s)=>{const r=l(),t=`You are a data analyst speaking Arabic. The user has provided you with data from a spreadsheet in CSV format. Your task is to answer the user's questions about this data.
If the user asks for a chart or visualization, you MUST respond with ONLY a valid JSON object for Chart.js. The JSON object should have 'type', 'data', and 'options' keys. Do not include any other text, explanation, or markdown formatting around the JSON. The chart labels and titles should be in Arabic.
For text-based answers, be concise, clear, and use Arabic.

Here is the data in CSV format:
---
${e.substring(0,1e4)}
---

Here is the user's question:
---
${s}
---
`;return(await d(t,r.model)).trim()},U=async e=>{const s=l(),r=`Explain the following spreadsheet formula in simple Arabic, detailing what each part does and what the overall result is. Formula: \`${e}\``;return(await d(r,s.model)).trim()},_=async e=>{const s=l(),t=M(e,25e3),o={type:a.ARRAY,items:{type:a.OBJECT,properties:{type:{type:a.STRING},content:{type:a.STRING},level:{type:a.NUMBER}},required:["type","content"]}},n=t.map(p=>{const c=`Analyze the following text and structure it into an array of objects, where each object represents a heading or a paragraph. The language of the content must be Arabic.
        Each object must have a "type" ('heading' or 'paragraph') and "content" (the text).
        For headings, also include a "level" (1 for main titles, 2 for sub-headings, etc.).
        Return a single JSON array.

        Text:
        ---
        ${p}
        ---
        `;return d(c,s.model,!0,o).then(A=>JSON.parse(A))});return(await Promise.all(n)).flat()},Q=async(e,s)=>{const r=l(),t=`Follow this instruction to edit the provided text: "${s}".
    Return ONLY the full, modified text. Do not add any commentary or explanation.
    
    Original Text:
    ---
    ${e}
    ---
    `;return(await d(t,r.model)).trim()},W=async()=>{const e=await fetch("https://openrouter.ai/api/v1/models");if(!e.ok)throw new Error("Failed to fetch models from OpenRouter API.");return(await e.json()).data.filter(t=>t.pricing.prompt==="0"&&t.pricing.completion==="0").map(t=>({id:t.id,name:t.name}))};export{g as A,D as a,q as b,_ as c,j as d,G as e,L as f,W as g,B as h,U as i,Y as j,Q as k,K as l,J as o,F as s};
