/**
 * Markdown Slide Deck Parser
 * Parses markdown files containing slides separated by '---'
 */
const SlidesParser = {
  /**
   * Parse raw markdown string into slides data structure
   * @param {string} mdText - Raw markdown content
   * @returns {Array} List of slide objects
   */
  parse(mdText) {
    if (!mdText) return [];
    
    // Split by slide separator --- (allow spaces around it, make sure it is a separate line)
    // We split on newlines followed by --- and another newline or end of file
    const rawSlides = mdText.split(/\n\s*---\s*\n/);
    
    const parsedSlides = [];
    
    rawSlides.forEach((slideContent, index) => {
      const trimmed = slideContent.trim();
      if (!trimmed) return;
      
      const lines = trimmed.split('\n');
      let slideNum = index + 1;
      let layout = '標題及內容';
      const bodyLines = [];
      
      // Parse slide header and meta
      lines.forEach(line => {
        const lineTrim = line.trim();
        if (!lineTrim) return;
        
        // Match Slide Number header
        const slideNumMatch = lineTrim.match(/^##\s+Slide\s+(\d+)/i);
        if (slideNumMatch) {
          slideNum = parseInt(slideNumMatch[1], 10);
          return;
        }
        
        // Match Layout
        const layoutMatch = lineTrim.match(/^\*Layout:\s*(.*?)\*$/i) || lineTrim.match(/^Layout:\s*(.*?)$/i) || lineTrim.match(/^_Layout:\s*(.*?)\_$/i);
        if (layoutMatch) {
          layout = layoutMatch[1].trim();
          return;
        }
        
        // Filter out page numbers on a single line
        if (lineTrim.match(/^\d+$/)) {
          return;
        }
        
        bodyLines.push(lineTrim);
      });
      
      // Determine Title using heuristics
      let title = `投影片 ${slideNum}`;
      if (bodyLines.length > 0) {
        // Look for headings first
        const headingLine = bodyLines.find(l => l.startsWith('#') || l.startsWith('##') || l.startsWith('###'));
        if (headingLine) {
          title = headingLine.replace(/^[#\s]+/, '').trim();
        } else {
          // Check if first line is short (<= 18 chars)
          const firstLine = bodyLines[0];
          const lastLine = bodyLines[bodyLines.length - 1];
          
          if (firstLine.length <= 18 && !firstLine.includes('，') && !firstLine.includes('。') && !firstLine.includes('：')) {
            title = firstLine;
          } else if (lastLine.length <= 25 && !lastLine.includes('，') && !lastLine.includes('。') && !lastLine.includes('：')) {
            title = lastLine;
          } else {
            // Default to first line truncated
            title = firstLine.substring(0, 20) + (firstLine.length > 20 ? '...' : '');
          }
        }
      }
      
      // Format title - strip MD characters
      title = title.replace(/[\*`#_\(\)]/g, '').trim();
      
      // Process body content into structured elements (paragraphs, list items)
      const elements = [];
      bodyLines.forEach(line => {
        let text = line.trim();
        if (!text) return;
        
        // Skip title if it is exactly the title line and there are other lines
        if (text.replace(/[\*`#_\(\)]/g, '').trim() === title && bodyLines.length > 1) {
          // We render it separately or skip to avoid duplication
          // Let's keep it but mark it as potential title so renderer knows
        }
        
        // Detect bullet list item
        const isBullet = text.startsWith('*') || text.startsWith('-') || text.match(/^[❶❷❸❹❺❻❼❽❾❿]/) || text.match(/^\d+\.\s/);
        
        if (isBullet) {
          // Clean bullet symbols
          let cleanText = text;
          if (text.startsWith('*') || text.startsWith('-')) {
            cleanText = text.substring(1).trim();
          }
          
          elements.push({
            type: 'bullet',
            content: cleanText
          });
        } else if (text.startsWith('#')) {
          // Headers
          const level = (text.match(/^#+/) || ['#'])[0].length;
          elements.push({
            type: 'header',
            level: level,
            content: text.replace(/^#+/, '').trim()
          });
        } else {
          // Paragraphs
          elements.push({
            type: 'paragraph',
            content: text
          });
        }
      });
      
      parsedSlides.push({
        id: index,
        slideNum,
        layout,
        title,
        elements,
        rawContent: trimmed
      });
    });
    
    return parsedSlides;
  },
  
  /**
   * Render slide elements to HTML string
   * @param {Object} slide - Parsed slide object
   * @returns {string} HTML string
   */
  renderHTML(slide) {
    if (!slide) return '';
    
    let html = '';
    
    // Title layout vs general layouts
    if (slide.layout.includes('標題投影片') || slide.layout.includes('主標題')) {
      const titleEl = slide.elements.find(e => e.type === 'paragraph' || e.type === 'header');
      const otherEls = slide.elements.filter(e => e !== titleEl);
      
      html += `<div class="slide-title-large">${slide.title}</div>`;
      
      otherEls.forEach(el => {
        if (el.content !== slide.title) {
          html += `<div class="slide-subtitle-large">${el.content}</div>`;
        }
      });
      
      return html;
    }
    
    // Standard layout
    html += `<h4 class="mb-4" style="font-size: 24px; font-weight: 700; border-bottom: 2px solid var(--border-color); padding-bottom: 12px; color: var(--text-primary);">${slide.title}</h4>`;
    
    let inList = false;
    let listHTML = '<div class="slide-bullet-list">';
    
    slide.elements.forEach(el => {
      // Avoid printing the title line again in the body if it matches the slide title
      if (el.content === slide.title && el.type !== 'bullet') {
        return;
      }
      
      if (el.type === 'bullet') {
        inList = true;
        listHTML += `
          <div class="slide-bullet-item">
            <i data-lucide="circle-dot" style="width: 14px; height: 14px; margin-top: 5px;"></i>
            <span>${this.formatMarkdownInline(el.content)}</span>
          </div>
        `;
      } else {
        if (inList) {
          listHTML += '</div>';
          html += listHTML;
          listHTML = '<div class="slide-bullet-list">';
          inList = false;
        }
        
        if (el.type === 'header') {
          const fontSize = el.level === 1 ? '22px' : el.level === 2 ? '18px' : '16px';
          html += `<h${el.level} style="font-size: ${fontSize}; font-weight: 700; margin: 16px 0 8px 0; color: var(--cyan);">${this.formatMarkdownInline(el.content)}</h${el.level}>`;
        } else {
          html += `<div class="slide-text-block"><p>${this.formatMarkdownInline(el.content)}</p></div>`;
        }
      }
    });
    
    if (inList) {
      listHTML += '</div>';
      html += listHTML;
    }
    
    return html;
  },
  
  /**
   * Helper to parse bold, italic, and inline code markdown
   * @param {string} text - Inline text
   * @returns {string} Formatted HTML text
   */
  formatMarkdownInline(text) {
    if (!text) return '';
    return text
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic *text*
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code `code`
      .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>')
      // Link [text](url)
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="inline-link">$1</a>');
  }
};
