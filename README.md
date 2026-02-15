# Street You There

Street You There is a powerful web application built with React and TypeScript that allows you to download high-resolution, 360° panoramic images directly from Google Street View.

## Features

- **Easy to Use**: Simply paste a Google Street View URL to get started.
- **High-Resolution Stitching**: Automatically fetches and stitches together image tiles to create a complete 360° equirectangular panorama.
- **Interactive Preview**: View your generated panorama with an interactive 360° viewer before downloading.
- **Downloadable Image**: Save the final high-quality JPEG image to your device.

## How It Works

1.  **Paste URL**: Find a location on Google Street View and copy the URL.
2.  **Generate**: Paste the URL into Street You There and click "Generate".
3.  **Stitch**: The application extracts the panorama ID, fetches all the necessary image tiles from Google's servers, and stitches them together on a canvas element.
4.  **Preview & Download**: Once the process is complete, you can preview the 360° image and download it.

## Author

- **jepixo**

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Pannellum (for the 360° viewer)