/* ==========================================================================
   🎬 Eol's Portfolio - Interactive Cinema & Player Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM Elements
  const header = document.getElementById('main-header');
  const exploreBtn = document.getElementById('explore-btn');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const videoCards = document.querySelectorAll('.video-card');
  const gallery = document.getElementById('gallery');
  
  // Lightbox Elements
  const lightbox = document.getElementById('video-lightbox');
  const lightboxCard = document.getElementById('lightbox-card');
  const playerContainer = document.getElementById('player-container');
  const closeBtn = document.getElementById('close-lightbox-btn');
  const theaterBtn = document.getElementById('theater-mode-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  
  // Lightbox Info Elements
  const modalMeta = document.getElementById('modal-video-meta');
  const modalTitle = document.getElementById('modal-video-title');
  const modalDesc = document.getElementById('modal-video-desc');

  // Icons inside Theater Button
  const theaterExpandIcon = document.getElementById('theater-expand-icon');
  const theaterShrinkIcon = document.getElementById('theater-shrink-icon');

  // Active Video State
  let activeVideoElement = null;

  // ==========================================================================
  // A. Header scroll animation
  // ==========================================================================
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // Smooth scroll to works section
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      const worksSection = document.getElementById('works');
      if (worksSection) {
        worksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // ==========================================================================
  // B. Category Grid Filtering (With Premium Fade Transitions)
  // ==========================================================================
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and add to clicked
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const filterValue = button.getAttribute('data-filter');

      // Add fade-out class to gallery
      gallery.style.opacity = '0';
      gallery.style.transform = 'translateY(10px)';

      setTimeout(() => {
        videoCards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (filterValue === 'all' || category === filterValue) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });

        // Trigger reflow & fade back in smoothly
        gallery.style.opacity = '1';
        gallery.style.transform = 'translateY(0)';
      }, 300);
    });
  });

  // Add transition to gallery for smooth filtering animation
  gallery.style.transition = 'opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';

  // ==========================================================================
  // C. Interactive Video Lightbox Player
  // ==========================================================================
  
  // Open Lightbox
  videoCards.forEach(card => {
    card.addEventListener('click', () => {
      const videoUrl = card.getAttribute('data-video-url');
      const title = card.querySelector('.card-title').innerText;
      const category = card.querySelector('.card-category-badge').innerText;
      const desc = card.querySelector('.card-desc').innerText;
      const clientMeta = card.querySelector('.card-meta span:first-child').innerText;
      const yearMeta = card.querySelector('.card-meta span:last-child').innerText;

      // Update Lightbox Information
      modalTitle.innerText = title;
      modalDesc.innerText = desc;
      modalMeta.innerHTML = `<span>${clientMeta}</span><span>•</span><span>Category: ${category}</span><span>•</span><span>${yearMeta}</span>`;

      // Clear previous player
      playerContainer.innerHTML = '';

      // Check if the URL is YouTube or direct MP4 video
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        let youtubeId = '';
        if (videoUrl.includes('youtu.be/')) {
          youtubeId = videoUrl.split('youtu.be/')[1].split('?')[0];
        } else {
          youtubeId = videoUrl.split('v=')[1].split('&')[0];
        }
        
        // Inject YouTube Player IFrame
        playerContainer.innerHTML = `
          <iframe 
            src="https://www.youtube.com/embed/${youtubeId}?autoplay=1&enablejsapi=1&rel=0" 
            title="${title}" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen>
          </iframe>`;
        activeVideoElement = playerContainer.querySelector('iframe');
      } else {
        // Direct MP4 Video Tag injection (Autoplay, Mute-to-unmute control, loop enabled)
        playerContainer.innerHTML = `
          <video controls autoplay playsinline loop>
            <source src="${videoUrl}" type="video/mp4">
            이 브라우저는 비디오 태그를 지원하지 않습니다.
          </video>`;
        activeVideoElement = playerContainer.querySelector('video');
        
        // Set high quality volume
        activeVideoElement.volume = 0.8;
      }

      // Activate Lightbox
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden'; // Lock main scrolling
    });
  });

  // Close Lightbox function
  const closeLightbox = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = 'auto'; // Restore main scrolling
    
    // Stop video / Remove player content to prevent sound playing in background
    setTimeout(() => {
      playerContainer.innerHTML = '';
      activeVideoElement = null;
      
      // Reset Theater Mode on close
      lightboxCard.classList.remove('theater-mode');
      if (theaterExpandIcon && theaterShrinkIcon) {
        theaterExpandIcon.style.display = 'block';
        theaterShrinkIcon.style.display = 'none';
      }
    }, 500); // Wait for fade-out transition to complete
  };

  // Bind close events
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  
  // Close when clicking on backdrop (outside the video modal card)
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // Close when pressing ESC key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });

  // ==========================================================================
  // D. Theater Mode (Cinematic Theater Mode / Expand Screen)
  // ==========================================================================
  if (theaterBtn) {
    theaterBtn.addEventListener('click', () => {
      lightboxCard.classList.toggle('theater-mode');
      
      const isTheater = lightboxCard.classList.contains('theater-mode');
      
      // Toggle button icons
      if (isTheater) {
        theaterExpandIcon.style.display = 'none';
        theaterShrinkIcon.style.display = 'block';
      } else {
        theaterExpandIcon.style.display = 'block';
        theaterShrinkIcon.style.display = 'none';
      }
    });
  }

  // ==========================================================================
  // E. Fullscreen Mode API
  // ==========================================================================
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!activeVideoElement) return;

      // Handle standard and cross-browser Fullscreen API on the video element itself
      try {
        if (activeVideoElement.requestFullscreen) {
          activeVideoElement.requestFullscreen();
        } else if (activeVideoElement.webkitRequestFullscreen) { /* Safari / Chrome */
          activeVideoElement.webkitRequestFullscreen();
        } else if (activeVideoElement.msRequestFullscreen) { /* IE11 */
          activeVideoElement.msRequestFullscreen();
        }
      } catch (err) {
        console.error('전체 화면 진입 중 오류 발생:', err);
      }
    });
  }
});
