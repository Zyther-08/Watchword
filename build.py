# Builds the store packages from this folder:
#   dist/watchword-edge.zip     for Microsoft Edge Add-ons
#   dist/watchword-chrome.zip   for the Chrome Web Store (same contents as the Edge package)
#   dist/watchword-firefox.zip  for Firefox Add-ons
#   dist/watchword.zip          to load unpacked in any of them while testing
#   dist/watchword-selftest.zip the local self-test page (not part of the extension)
import json, os, zipfile

FILES = ['core.js', 'packs.js', 'challenge.js', 'background.js', 'content.js', 'options.html', 'options.css',
         'options.js', 'guide.html', 'guide.css', 'guide.js', 'README.md', 'LICENSE', 'PRIVACY.md',
         '_locales/en/messages.json', 'icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-128.png']
here = os.path.dirname(os.path.abspath(__file__))
manifest = json.load(open(os.path.join(here, 'manifest.json'), encoding='utf-8'))

def edge(m):
    m = json.loads(json.dumps(m))
    m['background'] = {'service_worker': 'background.js'}
    m.pop('browser_specific_settings', None)
    return m

def firefox(m):
    m = json.loads(json.dumps(m))
    m['background'] = {'scripts': ['core.js', 'background.js']}
    return m

def write(name, m, files):
    os.makedirs(os.path.join(here, 'dist'), exist_ok=True)
    path = os.path.join(here, 'dist', name)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        if m is not None:
            z.writestr('manifest.json', json.dumps(m, indent=2, ensure_ascii=False) + '\n')
        for f in files:
            z.write(os.path.join(here, f), f)
    print(f'{name:28} version {manifest["version"]}')

write('watchword-edge.zip', edge(manifest), FILES)
write('watchword-chrome.zip', edge(manifest), FILES)
write('watchword-firefox.zip', firefox(manifest), FILES)
write('watchword.zip', manifest, FILES)
write('watchword-selftest.zip', None, ['selftest.html', 'selftest.js'])
