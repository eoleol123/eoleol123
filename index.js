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
  // B. Category Grid Filtering (With Premium Staggered Pop Transitions)
  // ==========================================================================
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('active')) return;

      // Remove active class from all buttons and add to clicked
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const filterValue = button.getAttribute('data-filter');

      // Toggling detailed-view layout based on active filter
      if (filterValue === 'all') {
        gallery.classList.remove('detailed-view');
      } else {
        gallery.classList.add('detailed-view');
      }

      // Filter logic with staggered pop animation
      let revealIndex = 0;

      videoCards.forEach(card => {
        const category = card.getAttribute('data-category');
        const isMatch = filterValue === 'all' || category === filterValue;

        if (isMatch) {
          card.classList.remove('hidden');
          // Clear any previous animation
          card.style.animation = 'none';
          // Trigger reflow to restart animation
          card.offsetHeight;
          // Apply staggered spring animation
          card.style.animation = `cardReveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both ${revealIndex * 0.08}s`;
          revealIndex++;
        } else {
          card.classList.add('hidden');
          card.style.animation = 'none';
        }
      });
    });
  });

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
        // Direct MP4 / MOV Video Tag injection (Autoplay, loop enabled)
        let mimeType = 'video/mp4';
        if (videoUrl.toLowerCase().endsWith('.mov')) {
          mimeType = 'video/quicktime';
        }
        playerContainer.innerHTML = `
          <video controls playsinline loop preload="auto">
            <source src="${videoUrl}" type="${mimeType}">
            이 브라우저는 비디오 태그를 지원하지 않습니다.
          </video>`;
        
        const video = playerContainer.querySelector('video');
        activeVideoElement = video;
        video.volume = 0.8;
        
        // Force loading the media resources
        video.load();
        
        // Delay play trigger to avoid GPU render clashes during CSS modal transition (350ms)
        setTimeout(() => {
          if (activeVideoElement !== video) return; // Prevent playing if user closed the modal quickly
          
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.warn("Unmuted autoplay prevented. Retrying with muted option:", error);
              // Fallback to muted playback which is always allowed by browsers
              video.muted = true;
              video.play().catch(err => {
                console.error("Muted playback also failed:", err);
              });
            });
          }
        }, 350);
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

  // ==========================================================================
  // F. Interactive Skill Detail Viewer
  // ==========================================================================
  const skillData = {
    unreal: {
      title: "Unreal Engine Portfolio",
      subtitle: "언리얼 시네마틱 영상 제작 & 레벨 디자인",
      images: ["assets/IMG_언리얼.jpg"]
    },
    unity: {
      title: "Unity 3D Portfolio",
      subtitle: "유니티 3D & 가상현실(VR) 개발",
      images: ["assets/IMG_유니티.jpg"]
    },
    blender: {
      title: "3D Asset Creation Portfolio",
      subtitle: "Blender & Substance Painter 에셋 제작",
      images: ["assets/IMG_루체 전신1.jpg", "assets/IMG_카민 전신1.jpg", "assets/IMG_미르 전신1.jpg"]
    },
    clip: {
      title: "Clip Studio Paint Portfolio",
      subtitle: "디지털 원화 드로잉 & 컨셉 아트",
      images: ["assets/IMG_클립스튜디오.jpg"]
    }
  };

  const skillCards = document.querySelectorAll('.skill-card');
  const skillViewer = document.getElementById('skill-detail-viewer');
  const viewerTitle = document.getElementById('viewer-title');
  const viewerSubtitle = document.getElementById('viewer-subtitle');
  const viewerImagesContainer = document.getElementById('viewer-images-container');
  const viewerCloseBtn = document.getElementById('viewer-close-btn');

  const closeSkillViewer = () => {
    if (skillViewer) {
      skillViewer.classList.add('hidden');
    }
    skillCards.forEach(c => c.classList.remove('active'));
  };

  skillCards.forEach(card => {
    const handleSkillClick = () => {
      const skillName = card.getAttribute('data-skill');
      const data = skillData[skillName];
      if (!data || !skillViewer) return;

      // Toggle close if clicking active card again
      if (card.classList.contains('active')) {
        closeSkillViewer();
        return;
      }

      // Toggle active states on cards
      skillCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      // Update texts
      if (viewerTitle) viewerTitle.innerText = data.title;
      if (viewerSubtitle) viewerSubtitle.innerText = data.subtitle;

      // Clear and populate images
      if (viewerImagesContainer) {
        viewerImagesContainer.innerHTML = '';
        
        // Distinguish single / multi layouts for correct styling
        if (data.images.length > 1) {
          viewerImagesContainer.className = 'viewer-images-container multi-images';
        } else {
          viewerImagesContainer.className = 'viewer-images-container single-image';
        }

        data.images.forEach(imgUrl => {
          const img = document.createElement('img');
          img.src = imgUrl;
          img.alt = `${data.title} Image`;
          img.className = 'skill-detail-img';
          img.loading = 'lazy';
          viewerImagesContainer.appendChild(img);
        });
      }

      // Show viewer
      skillViewer.classList.remove('hidden');

      // Smooth scroll into viewer area
      setTimeout(() => {
        skillViewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    };

    card.addEventListener('click', handleSkillClick);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSkillClick();
      }
    });
  });

  if (viewerCloseBtn) {
    viewerCloseBtn.addEventListener('click', closeSkillViewer);
  }
});
