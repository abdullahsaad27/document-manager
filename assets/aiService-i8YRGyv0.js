import{a as c,G as E,T as a}from"./settingsService-BwK4D_ha.js";import{l as x}from"./index-CHvME9zk.js";const S=t=>{const e=c().googleApiKey||void 0;if(!e)throw new h("Google API key is not configured. Please add it in Settings or as an environment variable.");return new E({apiKey:e})},v=async(t,s)=>{try{const r=S(),o=c().model||"gemini-3-flash-preview";return await r.models.generateContent({model:o,contents:t,config:s})}catch(r){console.error("Gemini Service Error:",r);const e=r instanceof Error?r.message:"An unknown error occurred with the Google AI service.";throw e.includes("API key not valid")||e.includes("quota")?new h(e):new Error(e)}},$=async t=>(await v(t)).text,k=async(t,s)=>(await v(t,{responseMimeType:"application/json",responseSchema:s})).text,I=async(t,s)=>(await v({parts:[s,{text:t}]})).text,R=async(t,s)=>{const e={parts:[{text:t},...s]};return(await v(e)).text};class h extends Error{constructor(s){super(s),this.name="ApiLimitError"}}const l=async(t,s,r=!1,e,o)=>{const n=c(),u=Date.now(),d=o?"Multimodal/OCR":"Text Generation",m=`REQ-${Math.random().toString(36).substr(2,5).toUpperCase()}`;x.info(`[${m}] بدء طلب الذكاء الاصطناعي`,`Provider: ${n.provider}, Model: ${s}, Type: ${d}`),console.log(`[AI Service] Starting handleApiCall. Provider: ${n.provider}, Model: ${n.model}, Action: ${o?"Multimodal/OCR":"Text"}`);try{let i;if(n.provider==="google")console.log("[AI Service] Calling Gemini Service..."),r?i=await k(t,e):o?i=await I(t,o):i=await $(t);else if(["openrouter","mistral"].includes(n.provider)){console.log("[AI Service] Calling Server Data Proxy...");const T="/api/ai",b=[];let p="chat";if(n.provider==="mistral"&&s==="mistral-ocr-latest"&&o&&(p="ocr"),p==="chat")if(o)if(o.inlineData.mimeType.startsWith("image/"))b.push({role:"user",content:[{type:"text",text:t},{type:"image_url",image_url:{url:`data:${o.inlineData.mimeType};base64,${o.inlineData.data}`}}]});else throw new Error(`Provider ${n.provider} does not support direct file analysis for mime type ${o.inlineData.mimeType}.`);else b.push({role:"user",content:t});const y=await fetch(T,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:n.provider,model:n.model,action:p,messages:p==="chat"?b:void 0,fileData:p==="ocr"?o.inlineData.data:void 0,fileMimeType:p==="ocr"?o.inlineData.mimeType:void 0,userApiKey:n.provider==="mistral"?n.mistralApiKey:n.provider==="openrouter"?n.openRouterApiKey:void 0,...r&&{response_format:{type:"json_object"}}})}),w=await y.json();if(!y.ok){const f=w?.error?.message||w?.message||`API Error: ${y.status}`;throw console.error(`[AI Service] Server Proxy Error: ${f}`),y.status===429||y.status===401?new h(f):new Error(f)}if(p==="ocr"){if(!w.pages)throw new Error("استجابة غير صالحة من نموذج OCR.");i=w.pages.map(f=>f.markdown).join(`

`)}else i=w.choices[0].message.content}else throw new Error("Unsupported AI provider.");const g=((Date.now()-u)/1e3).toFixed(2),A=i?.length||0;return x.success(`[${m}] اكتمل الطلب بنجاح`,`Duration: ${g}s, Output Size: ${A} chars`),console.log(`[AI Service] handleApiCall success. Result length: ${i?.length}`),i}catch(i){const g=((Date.now()-u)/1e3).toFixed(2),A=i instanceof Error?i.message:"Unknown error";throw x.error(`[${m}] فشل الطلب`,`Duration: ${g}s, Error: ${A}`),i instanceof h?i:(console.error("AI Service Error:",i),new Error(`خطأ في التواصل مع الذكاء الاصطناعي: ${A}`))}},C=(t,s)=>{const r=[];let e=0;for(;e<t.length;){let o=Math.min(e+s,t.length);if(o<t.length){const n=t.lastIndexOf(`

`,o);n>e+s/2&&(o=n)}r.push(t.substring(e,o)),e=o}return r},M=async(t,s,r)=>{const e=c();r?.("جاري إنشاء الملخص...");let o;if(s.startsWith("TEMPLATE:"))o=`${s.replace("TEMPLATE:","")}

Text to process:
${t}`;else switch(s){case"points":o=`Summarize the following text into key bullet points in Arabic:

${t}`;break;case"short":o=`Provide a short, one-paragraph summary of the following text in Arabic:

${t}`;break;case"detailed":o=`Provide an exhaustive and highly detailed summary of the following text in Arabic. Your goal is to create a summary so comprehensive that it could substitute for reading the original document. Capture all key arguments, data, narrative points, and conclusions. Structure the summary logically.

Text:
---
${t}
---`;break;case"simple":o=`Explain the following text in simple Arabic terms, as if for a beginner:

${t}`;break;default:o=`Summarize the following text in Arabic:

${t}`}return(await l(o,e.model)).trim()},P=async(t,s)=>{const r=c();let e;switch(s){case"points":e="This document is a series of images. Summarize its content into key bullet points in Arabic.";break;case"short":e="This document is a series of images. Provide a short, one-paragraph summary of its content in Arabic.";break;case"detailed":e="This document is a series of images. Provide a detailed summary of its content in Arabic, covering all main sections shown.";break;case"simple":e="This document is a series of images. Explain its content in simple Arabic terms, as if for a beginner.";break;default:e="This document is a series of images. Summarize its content in Arabic."}try{if(r.provider==="google")return await R(e,t);if(["openrouter","mistral"].includes(r.provider)){const o="/api/ai",n=[{type:"text",text:e}];t.forEach(i=>{n.push({type:"image_url",image_url:{url:`data:${i.inlineData.mimeType};base64,${i.inlineData.data}`}})});const u=[{role:"user",content:n}],d=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:r.provider,model:r.model,messages:u,userApiKey:r.provider==="mistral"?r.mistralApiKey:r.provider==="openrouter"?r.openRouterApiKey:void 0})}),m=await d.json();if(!d.ok){const i=m?.error?.message||`API Error: ${d.status}`;throw d.status===429||d.status===401?new h(i):new Error(i)}return m.choices[0].message.content.trim()}else throw new Error("Unsupported AI provider.")}catch(o){if(o instanceof h)throw o;console.error("AI Service Error (summarizeImages):",o);const n=o instanceof Error?o.message:"An unknown error occurred.";throw new Error(`An error occurred while communicating with the AI service: ${n}`)}},z=async(t,s)=>{const r=c();if(r.provider!=="google"&&!(r.provider==="mistral"&&r.model==="mistral-ocr-latest"))throw new Error(`مزود الخدمة '${r.provider}' لا يدعم تحليل ملفات PDF مباشرة.`);let e;if(s.startsWith("TEMPLATE:"))e=`This document is a file. Analyze its content (which may be text or images) and follow these instructions:
${s.replace("TEMPLATE:","")}`;else switch(s){case"points":e="This document is a file. Analyze its content (which may be text or images) and summarize it into key bullet points in Arabic.";break;case"short":e="This document is a file. Analyze its content (which may be text or images) and provide a short, one-paragraph summary of it in Arabic.";break;case"detailed":e="This document is a file. Analyze its content (which may be text or images) and provide an exhaustive and highly detailed summary in Arabic. Your goal is to create a summary so comprehensive that it could substitute for reading the original document. Capture all key arguments, data, narrative points, and conclusions. Structure the summary logically.";break;case"simple":e="This document is a file. Analyze its content (which may be text or images) and explain it in simple Arabic terms, as if for a beginner.";break;default:e="This document is a file. Analyze its content (which may be text or images) and summarize it in Arabic."}return(await l(e,r.model,!1,void 0,t)).trim()},D=async(t,s,r,e)=>{const o=c(),n=`Based on the following context, create a quiz in Arabic with exactly ${s} questions.
    Question type should be: ${r}.
    ${e?`Follow these custom instructions: ${e}`:""}
    For multiple-choice questions, provide 4 options.
    Return the response as a JSON object with a single key "quiz" which is an array of question objects.
    Each question object must have "type" ("multiple-choice", "true-false", or "open-ended"), "question", and for multiple-choice, an "options" array of strings.

    Context:
    ---
    ${t}
    ---
    `,u={type:a.OBJECT,properties:{quiz:{type:a.ARRAY,items:{type:a.OBJECT,properties:{type:{type:a.STRING},question:{type:a.STRING},options:{type:a.ARRAY,items:{type:a.STRING}}},required:["type","question"]}}}},d=await l(n,o.model,!0,u);return JSON.parse(d)},q=async(t,s)=>{const r=c(),o=`Correct the following quiz in Arabic based on the questions and user answers.
    Provide the correct answer for each question in Arabic.
    Determine if the user's answer was correct.
    Calculate a final score out of 100.
    Return a JSON object with "score" (a number) and "results" (an array).
    Each item in the results array should have "question", "userAnswer", "correctAnswer", and "isCorrect" (boolean).

    Quiz Data:
    ---
    ${JSON.stringify({questions:t,answers:s})}
    ---
    `,n={type:a.OBJECT,properties:{score:{type:a.NUMBER},results:{type:a.ARRAY,items:{type:a.OBJECT,properties:{question:{type:a.STRING},userAnswer:{type:a.STRING},correctAnswer:{type:a.STRING},isCorrect:{type:a.BOOLEAN}},required:["question","userAnswer","correctAnswer","isCorrect"]}}}},u=await l(o,r.model,!0,n);return JSON.parse(u)},F=async t=>{const s=c();return(await l("Extract all text from this image. Preserve line breaks. Respond in Arabic if the text is Arabic.",s.model,!1,void 0,t)).trim()},j=async(t,s)=>{const r=c();console.log(`[AI Service] extractTextFromPdfChunk called. Provider: ${r.provider}`);const e=s&&s.target;let o=`Extract text from this PDF chunk with high accuracy.
Target Languages: **Arabic & Kurdish**.
Strictly maintain the original structure using Markdown (headings, lists, tables).

**Critical Instructions:**
1. **Kurdish Text:** Write words correctly connected. DO NOT add extra spaces within words (e.g., write "ناوةڕاست" not "ن ا و ة ڕ ا س ت"). Preserve characters like (ێ، ۆ، ڵ، ە، ڕ).
2. **Format:** Use RTL direction. Represent headers with #.
3. **Empty Pages:** If a page is empty/image-only without text, write: \`[صفحة صورة أو فارغة]\`.
4. **Output:** Return ONLY the Markdown text. No introductions.
`;if(e?o+=`
5. **Translation:** Translate the extracted text to ${s.target}.
   - Source: ${s.source==="auto"?"Auto-detect":s.source}.
   - Output ONLY the translated Markdown.
`:o+=`
5. **Output:** Return only the extracted Markdown. No comments.
`,o+="\n6. **Separator:** End each page content with `---PAGEBREAK---`.\n",r.provider!=="google"&&!(r.provider==="mistral"&&r.model==="mistral-ocr-latest")){const n=`[AI Service] Provider ${r.provider} not supported for PDF OCR.`;throw console.error(n),new Error(`مزود الخدمة المختار (${r.provider}) لا يدعم تحليل ملفات PDF مباشرة لاستخراج النصوص. يرجى استخدام Google أو Mistral OCR.`)}try{const n=await l(o,r.model,!1,void 0,t);return console.log(`[AI Service] extractTextFromPdfChunk success. Result preview: ${n.substring(0,50)}...`),n.trim()}catch(n){throw console.error("[AI Service] extractTextFromPdfChunk failed:",n),n}},G=async t=>{const s=c();return(await l("Describe this image from a presentation slide in a concise and informative way, in Arabic.",s.model,!1,void 0,t)).trim()},J=async t=>{const s=c(),r=`Correct any grammatical and spelling errors in the following Arabic text. Return only the corrected text, without any introductory phrases or explanations.
    
    Text:
    ---
    ${t}
    ---
    `;return(await l(r,s.model)).trim()},K=async(t,s)=>{const r=c(),e=`You are a data analyst speaking Arabic. The user has provided you with data from a spreadsheet in CSV format. Your task is to answer the user's questions about this data.
If the user asks for a chart or visualization, you MUST respond with ONLY a valid JSON object for Chart.js. The JSON object should have 'type', 'data', and 'options' keys. Do not include any other text, explanation, or markdown formatting around the JSON. The chart labels and titles should be in Arabic.
For text-based answers, be concise, clear, and use Arabic.

Here is the data in CSV format:
---
${t.substring(0,1e4)}
---

Here is the user's question:
---
${s}
---
`;return(await l(e,r.model)).trim()},B=async t=>{const s=c(),r=`Explain the following spreadsheet formula in simple Arabic, detailing what each part does and what the overall result is. Formula: \`${t}\``;return(await l(r,s.model)).trim()},L=async t=>{const s=c(),e=C(t,25e3),o={type:a.ARRAY,items:{type:a.OBJECT,properties:{type:{type:a.STRING},content:{type:a.STRING},level:{type:a.NUMBER}},required:["type","content"]}},n=e.map(m=>{const i=`Analyze the following text and structure it into an array of objects, where each object represents a heading or a paragraph. The language of the content must be Arabic.
        Each object must have a "type" ('heading' or 'paragraph') and "content" (the text).
        For headings, also include a "level" (1 for main titles, 2 for sub-headings, etc.).
        Return a single JSON array.

        Text:
        ---
        ${m}
        ---
        `;return l(i,s.model,!0,o).then(g=>JSON.parse(g))});return(await Promise.all(n)).flat()},Y=async(t,s)=>{const r=c(),e=`Follow this instruction to edit the provided text: "${s}".
    Return ONLY the full, modified text. Do not add any commentary or explanation.
    
    Original Text:
    ---
    ${t}
    ---
    `;return(await l(e,r.model)).trim()},U=async()=>{const t=await fetch("https://openrouter.ai/api/v1/models");if(!t.ok)throw new Error("Failed to fetch models from OpenRouter API.");return(await t.json()).data.filter(e=>e.pricing.prompt==="0"&&e.pricing.completion==="0").map(e=>({id:e.id,name:e.name}))};export{h as A,M as a,P as b,L as c,D as d,q as e,J as f,U as g,G as h,B as i,K as j,Y as k,j as l,F as o,z as s};
