"use strict";

// Based heavily on markdown-it-footnote https://github.com/markdown-it/markdown-it-footnote

function render_footnote_links_summarylink_open(tokens, idx, options, env, slf) {
  var token = tokens[idx];
  if (token.attrGet("title")) {
    return '[<a href="' + token.attrGet("href") + '" title="' + token.attrGet("title") + '">';
  }
  return '[<a href="' + token.attrGet("href") + '">';
}

function render_footnote_links_summarylink_close(tokens, idx, options, env, slf) {
  return '</a>]';
}

function render_footnote_links_ref(tokens, idx, options, env, slf) {
  var token = tokens[idx];

  return '[<a href="#ref' + token.meta.id + '">ref' + token.meta.id + '</a>]';
}

function render_footnote_links_block_open(tokens, idx, options) {
  return '<section class="footnote-links"><h3 id="sources">Sources</h3><p>';
}

function render_footnote_links_block_close() {
  return '</p></section>\n';
}

function render_footnote_links_link_open(tokens, idx, options, env, slf) {
  var token = tokens[idx];
  return '[' + token.meta.id + ']\n' +
         '<a id="ref' + token.meta.id + '" class="footnote-links-link" href="' + token.meta.href + '">';
}

function render_footnote_links_link_close() {
  return '</a><br>\n';
}


// Simple string hashing function
// http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
function hashstr(str) {
  var hash = 0, i, chr, len;
  if (!str || str.length === 0) return hash;
  for (i = 0, len = str.length; i < len; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

module.exports = function footnote_links_plugin(md, opts_summary) {
  var summary = opts_summary ? true : false;

  // Helper functions
  var parseLinkLabel = md.helpers.parseLinkLabel,
      parseLinkDestination = md.helpers.parseLinkDestination,
      parseLinkTitle = md.helpers.parseLinkTitle,
      isSpace = md.utils.isSpace;

  // Render functions
  md.renderer.rules.footnote_links_summarylink_open = render_footnote_links_summarylink_open;
  md.renderer.rules.footnote_links_summarylink_close = render_footnote_links_summarylink_close;
  md.renderer.rules.footnote_links_ref = render_footnote_links_ref;
  md.renderer.rules.footnote_links_block_open = render_footnote_links_block_open;
  md.renderer.rules.footnote_links_block_close = render_footnote_links_block_close;
  md.renderer.rules.footnote_links_link_open = render_footnote_links_link_open;
  md.renderer.rules.footnote_links_link_close = render_footnote_links_link_close;

  // Tokenize +[...](...), +(...)
  function tokenize_footnote_links_link(state, silent) {
    var i,
        href,
        hrefhash,
        linkhash,
        title,
        labelEnd,
        labelStart,
        token,
        tokens,
        pos,
        res,
        code,
        footnote_link_id,
        oldPos = state.pos,
        max = state.posMax,
        start = state.pos;

    if (start + 2 >= max) { return false; }
    if (state.src.charCodeAt(start) !== 0x2B/* + */) { return false; }
    if (state.src.charCodeAt(start + 1) !== 0x5B/* [ */ && state.src.charCodeAt(start + 1) !== 0x28/* ( */) { return false; }

    if (state.src.charCodeAt(start + 1) === 0x28/* ( */) {
      // From: https://github.com/markdown-it/markdown-it/blob/master/lib/rules_inline/link.js
      // +(  <href>  )
      //   ^^ skipping these spaces
      pos = start + 2;
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (!isSpace(code) && code !== 0x0A) { break; }
      }
      if (pos >= max) { return false; }

      // +(  <href>  )
      //     ^^^^^^ parsing link destination
      start = pos;
      res = parseLinkDestination(state.src, pos, state.posMax);
      if (res.ok) {
        href = state.md.normalizeLink(res.str);
        if (state.md.validateLink(href)) {
          pos = res.pos;
        } else {
          href = '';
        }
      }

      // +(  <href>  )
      //           ^^ skipping these spaces
      start = pos;
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (!isSpace(code) && code !== 0x0A) { break; }
      }

      if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
        state.pos = oldPos;
        return false;
      }
      pos++;
    }
    else if (state.src.charCodeAt(start + 1) === 0x5B/* [ */) {
      // From: https://github.com/markdown-it/markdown-it/blob/master/lib/rules_inline/link.js
      labelStart = start + 2;
      labelEnd = parseLinkLabel(state, start + 1, true);

      // parser failed to find ']', so it's not a valid link
      if (labelEnd < 0) { return false; }

      pos = labelEnd + 1;
      if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
        // +[link](  <href>  "title"  )
        //         ^^ skipping these spaces
        pos++;
        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);
          if (!isSpace(code) && code !== 0x0A) { break; }
        }
        if (pos >= max) { return false; }

        // +[link](  <href>  "title"  )
        //           ^^^^^^ parsing link destination
        start = pos;
        res = parseLinkDestination(state.src, pos, state.posMax);
        if (res.ok) {
          href = state.md.normalizeLink(res.str);
          if (state.md.validateLink(href)) {
            pos = res.pos;
          } else {
            href = '';
          }
        }

        // +[link](  <href>  "title"  )
        //                 ^^ skipping these spaces
        start = pos;
        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);
          if (!isSpace(code) && code !== 0x0A) { break; }
        }

        // +[link](  <href>  "title"  )
        //                   ^^^^^^^ parsing link title
        res = parseLinkTitle(state.src, pos, state.posMax);
        if (pos < max && start !== pos && res.ok) {
          title = res.str;
          pos = res.pos;

          // +[link](  <href>  "title"  )
          //                          ^^ skipping these spaces
          for (; pos < max; pos++) {
            code = state.src.charCodeAt(pos);
            if (!isSpace(code) && code !== 0x0A) { break; }
          }
        } else {
          title = '';
        }

        if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
          state.pos = oldPos;
          return false;
        }
        pos++;
      } else {
        state.pos = oldPos;
        return false;
      }

    }

    if (!silent) {
      if (!state.env.footnote_links) {
        state.env.footnote_links = { links: [], link_refs: {} };
      }

      // Tokenize the link text
      if (labelStart && labelEnd) {
        state.md.inline.parse(
            state.src.slice(labelStart, labelEnd),
            state.md,
            state.env,
            tokens = []
          );
      }
      else {
        token = new state.Token('text', '', 0);
        token.content = href;
        tokens = [token];
      }

      if (summary) {
        token = state.push('footnote_links_summarylink_open', '', 1);
        token.attrs = [ [ 'href', href ] ];
        if (title) {
          token.attrs.push([ 'title', title ]);
        }

        // Fixup token levels and push to state
        for (i = 0; i < tokens.length; i++) {
          tokens[i].level = state.level;
          state.tokens.push(tokens[i]);
        }
        token = state.push('footnote_links_summarylink_close', '', -1);
      }
      else {
        // Map the href and tokens to previous entries, duplicates handled as per below:
        //   +(http://link1)        // [1] - http://link1
        //   +[test](http://link1)  // [2] - http://link1- Test
        //   +(http://link1)        // [2] - http://link1- Test
        //   +[test](http://link1)  // [2] - http://link1- Test
        //   +[blah](http://link1)  // [3] - http://link1- Blah
        //   +(http://link1)        // [3] - http://link1- Blah
        hrefhash = hashstr(href);
        linkhash = hashstr(hrefhash + JSON.stringify(tokens))
        if (linkhash in state.env.footnote_links.link_refs) {
          footnote_link_id = state.env.footnote_links.link_refs[linkhash];
        }
        else if (!labelStart && hrefhash in state.env.footnote_links.link_refs) {
          footnote_link_id = state.env.footnote_links.link_refs[hrefhash];
        }
        else {
          footnote_link_id = state.env.footnote_links.links.length;
          state.env.footnote_links.links[footnote_link_id] = { href: href, tokens: tokens, title: title };
          state.env.footnote_links.link_refs[hrefhash] = footnote_link_id;
          if (labelStart) {
            state.env.footnote_links.link_refs[linkhash] = footnote_link_id;
          }
        }

        token = state.push('footnote_links_ref', '', 0);
        token.meta = { id: footnote_link_id };
      }
    }

    state.pos = pos;
    state.posMax = max;
    return true;
  }

  // Glue footnote_links tokens to end of token stream
  function tokenize_footnote_links_tail(state) {
    var i, links, token, tokens;

    if (summary) { return; }
    if (!state.env.footnote_links) { return; }
    if (!state.env.footnote_links.links) { return; }
    links = state.env.footnote_links.links;

    token = new state.Token('footnote_links_block_open', '', 1);
    state.tokens.push(token);

    for (i = 0; i < links.length; i++) {
      token = new state.Token('footnote_links_link_open', '', 1);
      token.meta = { id: i, href: links[i].href, title: links[i].title };
      state.tokens.push(token);

      if (links[i].tokens) {
        token = new state.Token('inline', '', 0);
        token.children = links[i].tokens;
        token.content = '';
        state.tokens.push(token);
      }

      token = new state.Token('footnote_links_link_close', '', -1);
      state.tokens.push(token);
    }

    token = new state.Token('footnote_links_block_close', '', -1);
    state.tokens.push(token);
  }

  md.inline.ruler.before('link', 'footnote_links_link', tokenize_footnote_links_link);
  md.core.ruler.after('inline', 'footnote_links_tail', tokenize_footnote_links_tail);
};
