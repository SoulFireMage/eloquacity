"""Extract verbatim passages from Gutenberg plain-text files.

usage: python3 -I extract.py <gutdir> <specs.json> <out.json>
spec: {"key", "gid", "start", "n" (sentences) | "end" (phrase, inclusive)}
"""
import json, re, sys

gutdir, specs_path, out_path = sys.argv[1:4]
QUOTE = "[\"'‘’“”]"

def body(gid):
    raw = open(f"{gutdir}/{gid}.txt", encoding="utf-8").read().replace("\r", "")
    s = re.search(r"\*\*\* ?START OF.*?\*\*\*", raw)
    e = re.search(r"\*\*\* ?END OF", raw)
    raw = raw[s.end() if s else 0 : e.start() if e else len(raw)]
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", raw)]
    paras = [p.replace("_", "") for p in paras if p]
    return paras

def pattern(phrase):
    out = []
    for ch in phrase:
        if ch.isspace():
            if not out or out[-1] != r"\s+": out.append(r"\s+")
        elif ch in "\"'‘’“”": out.append(QUOTE)
        elif ch in "-—": out.append("(?:-|—|--)")
        else: out.append(re.escape(ch))
    return "".join(out)

END = re.compile(r"[.!?]+[\"'’”)]*(?=\s+[\"'‘“(]?[A-Z0-9]|$)")
cache, results = {}, []
for sp in json.load(open(specs_path)):
    paras = cache.setdefault(sp["gid"], body(sp["gid"]))
    text = "\n\n".join(paras)
    m = re.search(pattern(sp["start"]), text)
    if not m:
        results.append({**sp, "error": "start not found"}); continue
    i = m.start()
    if "end" in sp:
        e = re.compile(pattern(sp["end"])).search(text, i)
        if not e: results.append({**sp, "error": "end not found"}); continue
        j = e.end()
        while j < len(text) and text[j] in "\"'’”": j += 1
    else:
        j, count = i, 0
        para_end = text.find("\n\n", i)
        para_end = len(text) if para_end < 0 else para_end
        for em in END.finditer(text, i, para_end):
            j = em.end(); count += 1
            if count >= sp["n"]: break
        if count < sp["n"]: j = para_end
    out = text[i:j].strip()
    if sp["gid"] == 10:  # KJV: drop inline verse numbers ("3:2 ")
        out = re.sub(r"\b\d+:\d+\s+", "", out)
    results.append({**sp, "text": out})
json.dump(results, open(out_path, "w"), ensure_ascii=False, indent=1)
for r in results:
    print(f"--- {r['key']} ({r['gid']})", r.get("error", ""))
    if "text" in r: print(r["text"])
