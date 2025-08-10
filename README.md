# 🚚 Shipping Tracker

A web application to track shipments from different carriers with a beautiful, modern interface similar to AfterShip.

## ✨ Features

- **Real-time Tracking**: Track UPS shipments with live status updates
- **Beautiful UI**: Modern, responsive design with progress timelines
- **Shipment History**: Save and view your recent tracking history
- **Multi-carrier Support**: Ready for UPS, FedEx, USPS (UPS currently implemented)
- **Live Status Updates**: See exactly where your package is in the delivery process

## 🛠️ Technology Stack

- **Backend**: Node.js with Express
- **Frontend**: HTML, CSS, JavaScript
- **Web Scraping**: Puppeteer for real-time tracking data
- **Styling**: Modern CSS with responsive design

## 📋 Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)

## 🚀 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NayanSpace/Shipping-Information.git
   cd Shipping-Information
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

4. **Open your browser and go to:**
   ```
   http://localhost:3000
   ```

## 📱 Usage

1. **Enter Tracking Number**: Type your UPS tracking number in the input field
2. **Select Carrier**: Choose UPS from the dropdown (other carriers coming soon)
3. **Click Track**: The app will fetch live tracking information
4. **View Results**: See the current status and full progress timeline
5. **Check History**: View your recent tracking history below

## 🔧 Project Structure

```
Shipping-Information/
├── public/                 # Frontend files
│   ├── index.html         # Main web interface
│   ├── styles.css         # Styling
│   └── script.js          # Frontend JavaScript
├── server.js              # Express server
├── package.json           # Dependencies and scripts
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🎯 Current Features

### ✅ Implemented
- UPS tracking with real-time status
- Beautiful progress timeline with checkmarks
- Shipment history saved in browser
- Responsive design for mobile and desktop
- Error handling and loading states

### 🚧 Coming Soon
- FedEx tracking support
- USPS tracking support
- Email notifications
- Database storage for shipment history
- User accounts and authentication

## 🐛 Troubleshooting

### Common Issues

1. **"Could not retrieve tracking information"**
   - Check that the tracking number is correct
   - Ensure you have a stable internet connection
   - Try refreshing the page

2. **Browser window opens but doesn't load**
   - This is normal - the app uses a browser to scrape UPS data
   - Wait for the process to complete (usually 10-30 seconds)

3. **Node.js not found**
   - Install Node.js from https://nodejs.org/
   - Make sure to restart your terminal after installation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**Nayan** - [GitHub Profile](https://github.com/NayanSpace)

## 🙏 Acknowledgments

- UPS for providing tracking information
- Puppeteer team for the web scraping capabilities
- Express.js for the web framework 