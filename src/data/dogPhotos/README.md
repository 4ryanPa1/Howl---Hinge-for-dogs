# Bundled dog photo library

Add dog photos here to include them in generated Discover profiles. Put each
dog's photos in a folder named for its breed ID (or breed label), then a folder
named for the dog's profile ID (or name), for example:

```text
dogPhotos/
  Mixed Breed/
    Chud/
      photo-1.jpg
      photo-2.jpg
      photo-3.jpg
```

Supported formats are JPG, PNG, WebP, and AVIF. Breed folders must match an ID
or label from `../breeds.json`; the dog folder must match a profile ID or name,
and that dog must belong to the selected breed. Add three to six different
photos per dog. Each dog's profile uses only its own folder; existing bundled
illustrations are used until that dog has its own photos. The app randomizes
photo order and, unless `useAuthoredPrompts` is enabled for a profile, prompt
questions and suggested answers. Assignments stay consistent across reloads.
Restart the dev server or rebuild the app after adding photos. Only add photos
you have permission to use.
