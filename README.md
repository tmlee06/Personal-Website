# Tristan Lee - Personal Website

A modern, responsive portfolio website built with vanilla HTML, CSS, and JavaScript. This portfolio showcases your professional experience, skills, and projects in a clean, elegant design.

## 🚀 Features

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Modern UI/UX**: Clean, professional design with smooth animations
- **Interactive Elements**: Hover effects, smooth scrolling, and dynamic navigation
- **Contact Form**: Functional contact form with validation
- **SEO Optimized**: Semantic HTML structure for better search engine visibility
- **Fast Loading**: Optimized code and assets for quick page loads
- **Accessibility**: Built with accessibility best practices in mind

## 📁 File Structure

```
Portfolio/
├── index.html          # Main HTML file
├── styles.css          # CSS styles and responsive design
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## 🎨 Customization Guide

### Personal Information

1. **Name and Title**: Update the hero section in `index.html`
   ```html
   <h1 class="hero-title">
       Hi, I'm <span class="highlight">Tristan Lee</span>
   </h1>
   <p class="hero-subtitle">
       Your Professional Title
   </p>
   ```

2. **About Section**: Modify the about content in `index.html`
   ```html
   <div class="about-text">
       <p>Your personal description...</p>
   </div>
   ```

3. **Contact Information**: Update contact details in `index.html`
   ```html
   <div class="contact-item">
       <i class="fas fa-envelope"></i>
       <span>your.email@example.com</span>
   </div>
   ```

### Experience Section

Update the timeline items in `index.html` with your work experience:

```html
<div class="timeline-item">
    <div class="timeline-marker"></div>
    <div class="timeline-content">
        <h3>Your Job Title</h3>
        <h4>Company Name</h4>
        <span class="timeline-date">Start Date - End Date</span>
        <p>Job description...</p>
        <ul>
            <li>Key achievement 1</li>
            <li>Key achievement 2</li>
        </ul>
    </div>
</div>
```

### Skills Section

Modify the skills in `index.html`:

```html
<div class="skill-items">
    <span class="skill-item">React</span>
    <span class="skill-item">Node.js</span>
    <!-- Add more skills -->
</div>
```

### Projects Section

Update the project cards with your actual projects:

```html
<div class="project-card">
    <div class="project-image">
        <i class="fas fa-laptop-code"></i>
    </div>
    <div class="project-content">
        <h3>Project Name</h3>
        <p>Project description...</p>
        <div class="project-tech">
            <span>Technology 1</span>
            <span>Technology 2</span>
        </div>
        <div class="project-links">
            <a href="live-demo-url" class="project-link">
                <i class="fas fa-external-link-alt"></i> Live Demo
            </a>
            <a href="github-url" class="project-link">
                <i class="fab fa-github"></i> GitHub
            </a>
        </div>
    </div>
</div>
```

### Color Scheme

Update the color scheme in `styles.css`:

```css
:root {
    --primary-color: #2563eb;      /* Main blue color */
    --secondary-color: #fbbf24;    /* Accent yellow color */
    --text-color: #1f2937;         /* Dark text */
    --text-light: #6b7280;         /* Light text */
    --background: #ffffff;          /* Background */
    --background-alt: #f9fafb;     /* Alternative background */
}
```

## 🚀 Deployment

### Option 1: GitHub Pages
1. Push your code to a GitHub repository
2. Go to repository Settings > Pages
3. Select source branch (usually `main`)
4. Your site will be available at `https://username.github.io/repository-name`

### Option 2: Netlify
1. Drag and drop your project folder to [Netlify](https://netlify.com)
2. Your site will be deployed instantly with a custom URL

### Option 3: Vercel
1. Connect your GitHub repository to [Vercel](https://vercel.com)
2. Deploy with zero configuration

## 📱 Mobile Optimization

The website is fully responsive and includes:
- Mobile-first design approach
- Hamburger menu for mobile navigation
- Touch-friendly buttons and links
- Optimized images and fonts
- Smooth scrolling on all devices

## 🔧 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## 📈 Performance Features

- Optimized CSS and JavaScript
- Debounced scroll events
- Lazy loading animations
- Minimal external dependencies
- Compressed assets

## 🎯 SEO Features

- Semantic HTML structure
- Meta tags for social sharing
- Open Graph tags
- Structured data markup
- Fast loading times

## 📞 Support

If you need help customizing your portfolio or have any questions, feel free to reach out!

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**Built with ❤️ by Tristan Lee**

[LinkedIn](https://www.linkedin.com/in/tlee06/) | [GitHub](https://github.com/tlee06) | [Email](mailto:tristan@example.com)
