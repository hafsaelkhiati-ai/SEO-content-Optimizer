// ============================================================
//  GEO CONTENT AGENT — CORE PIPELINE
//  Steps: GSC check → SERP research → Gap analysis →
//         Outline → Draft writing → WP publish → Slack notify
// ============================================================

const axios = require('axios');

// ─── STEP 1: OPTIONAL GSC CHECK ─────────────────────────────
// Checks if the keyword already ranks in Search Console.
// Prevents you from writing about topics you already cover.
//
// Railway note: Railway has no persistent filesystem, so you
// cannot upload a JSON key file. Instead, set the env var
// GSC_CREDENTIALS_JSON to the entire contents of your service
// account JSON file. The code checks for this first.
async function checkGSC(keyword) {
  const credPath    = process.env.GSC_CREDENTIALS_PATH;
  const credJson    = process.env.GSC_CREDENTIALS_JSON;
  const siteUrl     = process.env.GSC_SITE_URL;
  if ((!credPath && !credJson) || !siteUrl) return null;

  try {
    const { google } = require('googleapis');

    // Build auth from inline JSON (Railway) or key file (VPS/local)
    let authConfig;
    if (credJson) {
      const credentials = JSON.parse(credJson);
      authConfig = { credentials, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] };
    } else {
      authConfig = { keyFile: credPath, scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] };
    }

    const auth = new google.auth.GoogleAuth(authConfig);
    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const { data } = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate, endDate,
        dimensions: ['query'],
        dimensionFilterGroups: [{
          filters: [{ dimension: 'query', operator: 'contains', expression: keyword }]
        }],
        rowLimit: 5,
      }
    });

    return data.rows || [];
  } catch (err) {
    console.warn('[GSC] Warning:', err.message);
    return null;
  }
}

// ─── STEP 2: SERP RESEARCH VIA PERPLEXITY ───────────────────
// Perplexity's sonar model does real-time web research.
// Returns structured SERP insights for gap analysis.
async function serpResearch(keyword) {
  // 🔑 Uses PERPLEXITY_API_KEY and PERPLEXITY_MODEL from .env
  const apiKey = process.env.PERPLEXITY_API_KEY;
  const model  = process.env.PERPLEXITY_MODEL || 'sonar-pro';
  const lang   = process.env.CONTENT_LANGUAGE || 'de';

  if (!apiKey) throw Object.assign(new Error('PERPLEXITY_API_KEY not set in .env'), { stage: 'serp' });

  const systemPrompt = `You are an expert SEO researcher. 
Analyse the top search results for the given keyword and return a structured JSON object.
Language of analysis: ${lang === 'de' ? 'German' : 'English'}.
Return ONLY valid JSON, no markdown fences.`;

  const userPrompt = `Keyword: "${keyword}"

Research the top 10 search results for this keyword and return JSON with this exact structure:
{
  "keyword": "${keyword}",
  "searchIntent": "informational|commercial|transactional|navigational",
  "avgWordCount": 1500,
  "topHeadings": ["H1 from result 1", "H1 from result 2", ...],
  "commonSubtopics": ["subtopic covered by 3+ articles", ...],
  "topEntities": ["brand/person/place mentioned frequently", ...],
  "commonQuestions": ["question from PAA/headings", ...],
  "sources": ["URL1", "URL2", ...]
}`;

  const { data } = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.1,
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const text = data.choices[0].message.content;
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    // If JSON parse fails, return raw text wrapped
    return { keyword, rawSerp: text, topHeadings: [], commonSubtopics: [], commonQuestions: [] };
  }
}

// ─── STEP 3: GAP ANALYSIS VIA GPT-4O ────────────────────────
// Finds angles, questions, and entities missing from top results.
// This is the core of GEO — answering what AI engines can't find elsewhere.
async function gapAnalysis(keyword, serpData) {
  // 🔑 Uses OPENAI_API_KEY and OPENAI_MODEL from .env
  const apiKey = process.env.OPENAI_API_KEY;
  const model  = process.env.OPENAI_MODEL || 'gpt-4o';
  const lang   = process.env.CONTENT_LANGUAGE || 'de';

  if (!apiKey) throw Object.assign(new Error('OPENAI_API_KEY not set in .env'), { stage: 'gap' });

  const prompt = `You are a GEO (Generative Engine Optimisation) content strategist.
Language: ${lang === 'de' ? 'German' : 'English'}.

Here is SERP research for the keyword "${keyword}":
${JSON.stringify(serpData, null, 2)}

Identify content gaps — angles, questions, entities, and subtopics that are:
1. NOT covered (or poorly covered) by existing top results
2. Likely to be cited by AI search engines (Gemini, Perplexity, ChatGPT Search)
3. Highly specific, data-driven, or definitively answerable

Return ONLY valid JSON:
{
  "missingAngles": ["angle not covered by competitors", ...],
  "missingQuestions": ["question not answered in top results", ...],
  "missingEntities": ["brand/concept/statistic missing", ...],
  "geoOpportunities": ["specific GEO-ready angle", ...],
  "recommendedWordCount": 2000,
  "recommendedTone": "authoritative/conversational/technical",
  "uniqueValueProposition": "One sentence: what makes this article different"
}`;

  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return JSON.parse(data.choices[0].message.content);
}

// ─── STEP 4: OUTLINE GENERATION VIA GPT-4O ──────────────────
async function generateOutline(keyword, serpData, gaps) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model  = process.env.OPENAI_MODEL || 'gpt-4o';
  const lang   = process.env.CONTENT_LANGUAGE || 'de';
  const minWords = parseInt(process.env.MIN_WORD_COUNT) || 1500;

  const prompt = `You are a GEO content strategist creating an SEO article outline.
Language: ${lang === 'de' ? 'German' : 'English'}.
Target word count: ${gaps.recommendedWordCount || minWords} words.

Keyword: "${keyword}"
Search Intent: ${serpData.searchIntent || 'informational'}
Gap analysis: ${JSON.stringify(gaps, null, 2)}

Create a detailed H1/H2/H3 outline optimised for GEO (being cited by AI search engines).
GEO principles:
- Start with a direct, concise answer to the main query (Answer Box style)
- Use specific, citable statistics and data points in headings
- Include "What is", "How to", "Why", "When" subheadings for AI snippet capture
- Each H2 section should answer one discrete question
- Include a structured FAQ section at the end

Return ONLY valid JSON:
{
  "h1": "Main title with primary keyword",
  "metaDescription": "150-160 char meta description",
  "introSummary": "2-3 sentence lead that directly answers the query",
  "sections": [
    {
      "h2": "Section heading",
      "wordCount": 300,
      "h3s": ["Subsection 1", "Subsection 2"],
      "keyPoints": ["bullet point to cover", ...]
    }
  ],
  "faqQuestions": ["FAQ Q1?", "FAQ Q2?", ...]
}`;

  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return JSON.parse(data.choices[0].message.content);
}

// ─── STEP 5: FULL DRAFT WRITING VIA GPT-4O ──────────────────
async function writeDraft(keyword, serpData, gaps, outline) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model  = process.env.OPENAI_MODEL || 'gpt-4o';
  const lang   = process.env.CONTENT_LANGUAGE || 'de';
  const minWords = parseInt(process.env.MIN_WORD_COUNT) || 1500;

  const systemPrompt = `You are an expert ${lang === 'de' ? 'German-language' : 'English-language'} content writer specialising in GEO (Generative Engine Optimisation).

GEO writing rules:
1. Open with a direct, 2-3 sentence answer to the main query
2. Use clear, structured language that AI engines can easily parse and cite
3. Cite specific statistics with source attributions (even if estimated — mark as "ca.")
4. Use H2/H3 headings that are themselves complete questions or statements
5. Include numbered lists and structured data where appropriate (AI loves structure)
6. Add schema-ready FAQ section at the end
7. Natural keyword placement — never forced
8. Avoid fluff, padding, and generic intros
9. Write in ${lang === 'de' ? 'formal German (Sie-form)' : 'professional English'}
10. Minimum ${minWords} words`;

  const userPrompt = `Write a complete, publish-ready article for the keyword: "${keyword}"

Use this outline:
${JSON.stringify(outline, null, 2)}

Also address these content gaps identified vs competitors:
${JSON.stringify(gaps.missingAngles || [], null, 2)}

Format:
- Use Markdown (# H1, ## H2, ### H3)
- Bold key terms with **term**
- Use numbered lists for steps, bullet points for features
- End with a ## Häufige Fragen (FAQ) section (or ## Frequently Asked Questions) covering:
${JSON.stringify(outline.faqQuestions || [], null, 2)}

Write the complete article now. Do not include any preamble or explanation.`;

  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.5,
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  return data.choices[0].message.content;
}

// ─── STEP 6: WORDPRESS PUBLISH ──────────────────────────────
async function publishToWordPress(outline, draft, keyword) {
  const wpUrl   = process.env.WORDPRESS_URL;
  const wpUser  = process.env.WORDPRESS_USERNAME;
  const wpPass  = process.env.WORDPRESS_APP_PASSWORD;
  const status  = process.env.WP_POST_STATUS || 'draft';
  const catId   = parseInt(process.env.DEFAULT_CATEGORY_ID) || 1;

  if (!wpUrl || !wpUser || !wpPass) {
    throw Object.assign(
      new Error('WordPress credentials not set in .env (WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD)'),
      { stage: 'publish' }
    );
  }

  // Convert Markdown to HTML (simple conversion — use marked lib)
  const { marked } = require('marked');
  const htmlContent = marked(draft);

  // 🔑 WordPress Application Password auth
  // Generate one at: WP Admin → Users → Your Profile → Application Passwords
  const token = Buffer.from(`${wpUser}:${wpPass}`).toString('base64');

  const postData = {
    title: outline.h1 || keyword,
    content: htmlContent,
    status,                          // 'draft' or 'publish'
    excerpt: outline.metaDescription || '',
    categories: [catId],
    tags: [keyword.toLowerCase()],
    meta: {
      // Yoast SEO meta fields (optional — only works if Yoast is installed)
      _yoast_wpseo_title: outline.h1,
      _yoast_wpseo_metadesc: outline.metaDescription,
      _yoast_wpseo_focuskw: keyword,
    }
  };

  const { data } = await axios.post(
    `${wpUrl}/wp-json/wp/v2/posts`,
    postData,
    {
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return {
    id: data.id,
    url: data.link,
    editUrl: `${wpUrl}/wp-admin/post.php?post=${data.id}&action=edit`,
    status: data.status,
  };
}

// ─── STEP 7: SLACK NOTIFICATION ─────────────────────────────
async function sendSlackNotification(keyword, wpPost, wordCount, cost) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;   // Slack is optional

  const message = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🟢 New Article Draft Ready' }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Keyword:*\n${keyword}` },
          { type: 'mrkdwn', text: `*Word Count:*\n${wordCount}` },
          { type: 'mrkdwn', text: `*API Cost:*\n${cost}` },
          { type: 'mrkdwn', text: `*Status:*\n${wpPost?.status || 'generated'}` },
        ]
      },
      ...(wpPost?.editUrl ? [{
        type: 'actions',
        elements: [{
          type: 'button',
          text: { type: 'plain_text', text: 'Edit in WordPress →' },
          url: wpPost.editUrl,
          style: 'primary',
        }]
      }] : []),
    ]
  };

  await axios.post(webhook, message, { timeout: 5000 });
}

// ─── COST ESTIMATOR ─────────────────────────────────────────
function estimateCost(draftLength) {
  // Rough token estimates:
  // Perplexity sonar-pro: ~$0.001 per request (SERP research)
  // GPT-4o: ~$0.005 input + $0.015 output per 1K tokens
  const tokens = Math.round(draftLength / 4);
  const openaiCost = ((tokens * 0.015) / 1000) + 0.01;  // output tokens + input
  const perplexityCost = 0.005;
  const total = openaiCost + perplexityCost;
  return `€${total.toFixed(3)}`;
}

// ─── MAIN PIPELINE (STREAMING) ───────────────────────────────
async function generateArticle({ keyword, publish, notify, checkGsc, onStageStart, onStageDone }) {
  const startTime = Date.now();
  let gscData = null;

  // Step 1: GSC check (optional)
  if (checkGsc) {
    onStageStart?.('serp');
    gscData = await checkGSC(keyword);
    if (gscData && gscData.length > 0) {
      console.log(`[GSC] Keyword "${keyword}" already has rankings — proceeding anyway`);
    }
  }

  // Step 2: SERP research
  onStageStart?.('serp');
  const serpData = await serpResearch(keyword);
  onStageDone?.('serp');

  // Step 3: Gap analysis
  onStageStart?.('gap');
  const gaps = await gapAnalysis(keyword, serpData);
  onStageDone?.('gap');

  // Step 4: Outline
  onStageStart?.('outline');
  const outline = await generateOutline(keyword, serpData, gaps);
  onStageDone?.('outline');

  // Step 5: Draft
  onStageStart?.('draft');
  const draft = await writeDraft(keyword, serpData, gaps, outline);
  onStageDone?.('draft');

  // Calculate stats
  const wordCount = draft.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);
  const cost = estimateCost(draft.length);

  let wpPost = null;

  // Step 6: WordPress publish
  onStageStart?.('publish');
  if (publish) {
    wpPost = await publishToWordPress(outline, draft, keyword);
  }
  onStageDone?.('publish');

  // Step 7: Slack notification
  if (notify) {
    await sendSlackNotification(keyword, wpPost, wordCount, cost);
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[Agent] "${keyword}" done in ${duration}s · ${wordCount} words · ${cost}`);

  // Format outline for display
  const outlineText = formatOutlineForDisplay(outline);
  const gapText = formatGapsForDisplay(gaps);

  return {
    keyword,
    outline: outlineText,
    outlineJson: outline,
    draft,
    gapAnalysis: gapText,
    gapJson: gaps,
    serpData,
    wordCount,
    readingTime,
    cost,
    duration,
    wpUrl: wpPost?.editUrl || null,
    wpPostId: wpPost?.id || null,
    gscData,
  };
}

// ─── SYNC VERSION (for bulk queue) ──────────────────────────
async function generateArticleSync(options) {
  return generateArticle({ ...options, onStageStart: null, onStageDone: null });
}

// ─── DISPLAY FORMATTERS ──────────────────────────────────────
function formatOutlineForDisplay(outline) {
  if (!outline?.h1) return JSON.stringify(outline, null, 2);
  let out = `# ${outline.h1}\n\nMeta: ${outline.metaDescription || ''}\n\nIntro: ${outline.introSummary || ''}\n\n`;
  (outline.sections || []).forEach(s => {
    out += `## ${s.h2}  (~${s.wordCount || 0} words)\n`;
    (s.h3s || []).forEach(h3 => out += `   ### ${h3}\n`);
    (s.keyPoints || []).forEach(p => out += `   • ${p}\n`);
    out += '\n';
  });
  if (outline.faqQuestions?.length) {
    out += `## FAQ\n${outline.faqQuestions.map(q => `• ${q}`).join('\n')}\n`;
  }
  return out;
}

function formatGapsForDisplay(gaps) {
  if (!gaps) return '';
  let out = `MISSING ANGLES:\n${(gaps.missingAngles || []).map(a => `• ${a}`).join('\n')}\n\n`;
  out += `MISSING QUESTIONS:\n${(gaps.missingQuestions || []).map(q => `• ${q}`).join('\n')}\n\n`;
  out += `GEO OPPORTUNITIES:\n${(gaps.geoOpportunities || []).map(g => `• ${g}`).join('\n')}\n\n`;
  out += `UNIQUE VALUE: ${gaps.uniqueValueProposition || ''}`;
  return out;
}

module.exports = { generateArticle, generateArticleSync };
