
/**
 * LA VAGUE - Contact Page Logic
 */
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    const phoneInput = document.getElementById('phone');
    
    // Add phone input field if not exists (for phone masking demo)
    if (contactForm && !phoneInput) {
        const subjectGroup = document.getElementById('subject')?.parentElement;
        if (subjectGroup) {
            const phoneGroup = document.createElement('div');
            phoneGroup.className = 'form-group';
            phoneGroup.innerHTML = `
                <label for="phone">Phone (optional)</label>
                <input type="tel" id="phone" placeholder="+1 (555) 123-4567">
            `;
            subjectGroup.after(phoneGroup);
            
            // Apply phone masking
            const newPhoneInput = document.getElementById('phone');
            newPhoneInput?.addEventListener('input', function(e) {
                if (typeof InputMasks !== 'undefined') {
                    this.value = InputMasks.phoneNumber(this.value, 'auto');
                }
            });
        }
    } else if (phoneInput) {
        // Apply phone masking to existing phone input
        phoneInput.addEventListener('input', function(e) {
            if (typeof InputMasks !== 'undefined') {
                this.value = InputMasks.phoneNumber(this.value, 'auto');
            }
        });
    }
    
    // Form submission with button state management
    contactForm?.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        
        // Validate email
        const emailInput = document.getElementById('email');
        if (emailInput && emailInput.value && typeof FormValidation !== 'undefined' && !FormValidation.email(emailInput.value)) {
            emailInput.classList.add('error');
            alert('Please enter a valid email address');
            return;
        }
        
        // Set loading state
        if (typeof ButtonState !== 'undefined') {
            ButtonState.setLoading(submitBtn, 'Sending...');
        }
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Show success
        if (typeof ButtonState !== 'undefined') {
            ButtonState.setSuccess(submitBtn, 'Message Sent!');
        }
        this.reset();
    });
});
