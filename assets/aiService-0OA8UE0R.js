import{a as c,G as S,T as i}from"./settingsService-p0j8CqeW.js";import{l as x}from"./index-BTUQfSWa.js";const E=e=>{const s=c().googleApiKey||void 0;if(!s)throw new h("Google API key is not configured. Please add it in Settings or as an environment variable.");return new S({apiKey:s})},b=async(e,t)=>{try{const r=E(),o=c().model||"gemini-3-flash-preview";return await r.models.generateContent({model:o,contents:e,config:t})}catch(r){console.error("Gemini Service Error:",r);const s=r instanceof Error?r.message:"An unknown error occurred with the Google AI service.";throw s.includes("API key not valid")||s.includes("quota")?new h(s):new Error(s)}},$=async e=>(await b(e)).text,k=async(e,t)=>(await b(e,{responseMimeType:"application/json",responseSchema:t})).text,I=async(e,t)=>(await b({parts:[t,{text:e}]})).text,C=async(e,t)=>{const s={parts:[{text:e},...t]};return(await b(s)).text};class h extends Error{constructor(t){super(t),this.name="ApiLimitError"}}const l=async(e,t,r=!1,s,o)=>{const n=c(),u=Date.now(),d=o?"Multimodal/OCR":"Text Generation",m=`REQ-${Math.random().toString(36).substr(2,5).toUpperCase()}`;x.info(`[${m}] بدء طلب الذكاء الاصطناعي`,`Provider: ${n.provider}, Model: ${t}, Type: ${d}`),console.log(`[AI Service] Starting handleApiCall. Provider: ${n.provider}, Model: ${n.model}, Action: ${o?"Multimodal/OCR":"Text"}`);try{let a;if(n.provider==="google")console.log("[AI Service] Calling Gemini Service..."),r?a=await k(e,s):o?a=await I(e,o):a=await $(e);else if(["openai","openrouter","mistral"].includes(n.provider)){console.log("[AI Service] Calling Server Data Proxy...");const T="/api/ai",v=[];let p="chat";if(n.provider==="mistral"&&t==="mistral-ocr-latest"&&o&&(p="ocr"),p==="chat")if(o)if(o.inlineData.mimeType.startsWith("image/"))v.push({role:"user",content:[{type:"text",text:e},{type:"image_url",image_url:{url:`data:${o.inlineData.mimeType};base64,${o.inlineData.data}`}}]});else throw new Error(`Provider ${n.provider} does not support direct file analysis for mime type ${o.inlineData.mimeType}.`);else v.push({role:"user",content:e});const y=await fetch(T,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:n.provider,model:n.model,action:p,messages:p==="chat"?v:void 0,fileData:p==="ocr"?o.inlineData.data:void 0,fileMimeType:p==="ocr"?o.inlineData.mimeType:void 0,userApiKey:n.provider==="mistral"?n.mistralApiKey:void 0,...r&&{response_format:{type:"json_object"}}})}),w=await y.json();if(!y.ok){const f=w?.error?.message||w?.message||`API Error: ${y.status}`;throw console.error(`[AI Service] Server Proxy Error: ${f}`),y.status===429||y.status===401?new h(f):new Error(f)}if(p==="ocr"){if(!w.pages)throw new Error("استجابة غير صالحة من نموذج OCR.");a=w.pages.map(f=>f.markdown).join(`

`)}else a=w.choices[0].message.content}else throw new Error("Unsupported AI provider.");const g=((Date.now()-u)/1e3).toFixed(2),A=a?.length||0;return x.success(`[${m}] اكتمل الطلب بنجاح`,`Duration: ${g}s, Output Size: ${A} chars`),console.log(`[AI Service] handleApiCall success. Result length: ${a?.length}`),a}catch(a){const g=((Date.now()-u)/1e3).toFixed(2),A=a instanceof Error?a.message:"Unknown error";throw x.error(`[${m}] فشل الطلب`,`Duration: ${g}s, Error: ${A}`),a instanceof h?a:(console.error("AI Service Error:",a),new Error(`خطأ في التواصل مع الذكاء الاصطناعي: ${A}`))}},O=(e,t)=>{const r=[];let s=0;for(;s<e.length;){let o=Math.min(s+t,e.length);if(o<e.length){const n=e.lastIndexOf(`

`,o);n>s+t/2&&(o=n)}r.push(e.substring(s,o)),s=o}return r},M=async(e,t,r)=>{const s=c();r?.("جاري إنشاء الملخص...");let o;if(t.startsWith("TEMPLATE:"))o=`${t.replace("TEMPLATE:","")}

Text to process:
${e}`;else switch(t){case"points":o=`Summarize the following text into key bullet points in Arabic:

${e}`;break;case"short":o=`Provide a short, one-paragraph summary of the following text in Arabic:

${e}`;break;case"detailed":o=`Provide an exhaustive and highly detailed summary of the following text in Arabic. Your goal is to create a summary so comprehensive that it could substitute for reading the original document. Capture all key arguments, data, narrative points, and conclusions. Structure the summary logically.

Text:
---
${e}
---`;break;case"simple":o=`Explain the following text in simple Arabic terms, as if for a beginner:

${e}`;break;default:o=`Summarize the following text in Arabic:

${e}`}return(await l(o,s.model)).trim()},P=async(e,t)=>{const r=c();let s;switch(t){case"points":s="This document is a series of images. Summarize its content into key bullet points in Arabic.";break;case"short":s="This document is a series of images. Provide a short, one-paragraph summary of its content in Arabic.";break;case"detailed":s="This document is a series of images. Provide a detailed summary of its content in Arabic, covering all main sections shown.";break;case"simple":s="This document is a series of images. Explain its content in simple Arabic terms, as if for a beginner.";break;default:s="This document is a series of images. Summarize its content in Arabic."}try{if(r.provider==="google")return await C(s,e);if(["openai","openrouter","mistral"].includes(r.provider)){const o="/api/ai",n=[{type:"text",text:s}];e.forEach(a=>{n.push({type:"image_url",image_url:{url:`data:${a.inlineData.mimeType};base64,${a.inlineData.data}`}})});const u=[{role:"user",content:n}],d=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:r.provider,model:r.model,messages:u,userApiKey:r.provider==="mistral"?r.mistralApiKey:void 0})}),m=await d.json();if(!d.ok){const a=m?.error?.message||`API Error: ${d.status}`;throw d.status===429||d.status===401?new h(a):new Error(a)}return m.choices[0].message.content.trim()}else throw new Error("Unsupported AI provider.")}catch(o){if(o instanceof h)throw o;console.error("AI Service Error (summarizeImages):",o);const n=o instanceof Error?o.message:"An unknown error occurred.";throw new Error(`An error occurred while communicating with the AI service: ${n}`)}},z=async(e,t)=>{const r=c();if(r.provider!=="google"&&!(r.provider==="mistral"&&r.model==="mistral-ocr-latest"))throw new Error(`مزود الخدمة '${r.provider}' لا يدعم تحليل ملفات PDF مباشرة.`);let s;if(t.startsWith("TEMPLATE:"))s=`This document is a file. Analyze its content (which may be text or images) and follow these instructions:
${t.replace("TEMPLATE:","")}`;else switch(t){case"points":s="This document is a file. Analyze its content (which may be text or images) and summarize it into key bullet points in Arabic.";break;case"short":s="This document is a file. Analyze its content (which may be text or images) and provide a short, one-paragraph summary of it in Arabic.";break;case"detailed":s="This document is a file. Analyze its content (which may be text or images) and provide an exhaustive and highly detailed summary in Arabic. Your goal is to create a summary so comprehensive that it could substitute for reading the original document. Capture all key arguments, data, narrative points, and conclusions. Structure the summary logically.";break;case"simple":s="This document is a file. Analyze its content (which may be text or images) and explain it in simple Arabic terms, as if for a beginner.";break;default:s="This document is a file. Analyze its content (which may be text or images) and summarize it in Arabic."}return(await l(s,r.model,!1,void 0,e)).trim()},D=async(e,t,r,s)=>{const o=c(),n=`Based on the following context, create a quiz in Arabic with exactly ${t} questions.
    Question type should be: ${r}.
    ${s?`Follow these custom instructions: ${s}`:""}
    For multiple-choice questions, provide 4 options.
    Return the response as a JSON object with a single key "quiz" which is an array of question objects.
    Each question object must have "type" ("multiple-choice", "true-false", or "open-ended"), "question", and for multiple-choice, an "options" array of strings.

    Context:
    ---
    ${e}
    ---
    `,u={type:i.OBJECT,properties:{quiz:{type:i.ARRAY,items:{type:i.OBJECT,properties:{type:{type:i.STRING},question:{type:i.STRING},options:{type:i.ARRAY,items:{type:i.STRING}}},required:["type","question"]}}}},d=await l(n,o.model,!0,u);return JSON.parse(d)},q=async(e,t)=>{const r=c(),o=`Correct the following quiz in Arabic based on the questions and user answers.
    Provide the correct answer for each question in Arabic.
    Determine if the user's answer was correct.
    Calculate a final score out of 100.
    Return a JSON object with "score" (a number) and "results" (an array).
    Each item in the results array should have "question", "userAnswer", "correctAnswer", and "isCorrect" (boolean).

    Quiz Data:
    ---
    ${JSON.stringify({questions:e,answers:t})}
    ---
    `,n={type:i.OBJECT,properties:{score:{type:i.NUMBER},results:{type:i.ARRAY,items:{type:i.OBJECT,properties:{question:{type:i.STRING},userAnswer:{type:i.STRING},correctAnswer:{type:i.STRING},isCorrect:{type:i.BOOLEAN}},required:["question","userAnswer","correctAnswer","isCorrect"]}}}},u=await l(o,r.model,!0,n);return JSON.parse(u)},F=async e=>{const t=c();return(await l("Extract all text from this image. Preserve line breaks. Respond in Arabic if the text is Arabic.",t.model,!1,void 0,e)).trim()},j=async(e,t)=>{const r=c();console.log(`[AI Service] extractTextFromPdfChunk called. Provider: ${r.provider}`);const s=t&&t.target;let o=`Extract text from this PDF chunk with high accuracy.
Target Languages: **Arabic & Kurdish**.
Strictly maintain the original structure using Markdown (headings, lists, tables).

**Critical Instructions:**
1. **Kurdish Text:** Write words correctly connected. DO NOT add extra spaces within words (e.g., write "ناوةڕاست" not "ن ا و ة ڕ ا س ت"). Preserve characters like (ێ، ۆ، ڵ، ە، ڕ).
2. **Format:** Use RTL direction. Represent headers with #.
3. **Empty Pages:** If a page is empty/image-only without text, write: \`[صفحة صورة أو فارغة]\`.
4. **Output:** Return ONLY the Markdown text. No introductions.
`;if(s?o+=`
5. **Translation:** Translate the extracted text to ${t.target}.
   - Source: ${t.source==="auto"?"Auto-detect":t.source}.
   - Output ONLY the translated Markdown.
`:o+=`
5. **Output:** Return only the extracted Markdown. No comments.
`,o+="\n6. **Separator:** End each page content with `---PAGEBREAK---`.\n",r.provider!=="google"&&!(r.provider==="mistral"&&r.model==="mistral-ocr-latest")){const n=`[AI Service] Provider ${r.provider} not supported for PDF OCR.`;throw console.error(n),new Error(`مزود الخدمة المختار (${r.provider}) لا يدعم تحليل ملفات PDF مباشرة لاستخراج النصوص. يرجى استخدام Google أو Mistral OCR.`)}try{const n=await l(o,r.model,!1,void 0,e);return console.log(`[AI Service] extractTextFromPdfChunk success. Result preview: ${n.substring(0,50)}...`),n.trim()}catch(n){throw console.error("[AI Service] extractTextFromPdfChunk failed:",n),n}},G=async e=>{const t=c();return(await l("Describe this image from a presentation slide in a concise and informative way, in Arabic.",t.model,!1,void 0,e)).trim()},J=async e=>{const t=c(),r=`Correct any grammatical and spelling errors in the following Arabic text. Return only the corrected text, without any introductory phrases or explanations.
    
    Text:
    ---
    ${e}
    ---
    `;return(await l(r,t.model)).trim()},B=async(e,t)=>{const r=c(),s=`You are a data analyst speaking Arabic. The user has provided you with data from a spreadsheet in CSV format. Your task is to answer the user's questions about this data.
If the user asks for a chart or visualization, you MUST respond with ONLY a valid JSON object for Chart.js. The JSON object should have 'type', 'data', and 'options' keys. Do not include any other text, explanation, or markdown formatting around the JSON. The chart labels and titles should be in Arabic.
For text-based answers, be concise, clear, and use Arabic.

Here is the data in CSV format:
---
${e.substring(0,1e4)}
---

Here is the user's question:
---
${t}
---
`;return(await l(s,r.model)).trim()},K=async e=>{const t=c(),r=`Explain the following spreadsheet formula in simple Arabic, detailing what each part does and what the overall result is. Formula: \`${e}\``;return(await l(r,t.model)).trim()},L=async e=>{const t=c(),s=O(e,25e3),o={type:i.ARRAY,items:{type:i.OBJECT,properties:{type:{type:i.STRING},content:{type:i.STRING},level:{type:i.NUMBER}},required:["type","content"]}},n=s.map(m=>{const a=`Analyze the following text and structure it into an array of objects, where each object represents a heading or a paragraph. The language of the content must be Arabic.
        Each object must have a "type" ('heading' or 'paragraph') and "content" (the text).
        For headings, also include a "level" (1 for main titles, 2 for sub-headings, etc.).
        Return a single JSON array.

        Text:
        ---
        ${m}
        ---
        `;return l(a,t.model,!0,o).then(g=>JSON.parse(g))});return(await Promise.all(n)).flat()},Y=async(e,t)=>{const r=c(),s=`Follow this instruction to edit the provided text: "${t}".
    Return ONLY the full, modified text. Do not add any commentary or explanation.
    
    Original Text:
    ---
    ${e}
    ---
    `;return(await l(s,r.model)).trim()},U=async()=>{const e=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:"openrouter",action:"fetchModels"})});if(!e.ok)throw new Error("Failed to fetch models from OpenRouter via proxy.");const{data:t}=await e.json();return t};export{h as A,M as a,P as b,L as c,D as d,q as e,J as f,U as g,G as h,K as i,B as j,Y as k,j as l,F as o,z as s};
