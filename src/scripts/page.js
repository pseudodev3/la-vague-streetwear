/**
 * LA VAGUE - Common Page Logic
 */

// Nav scroll effect
window.addEventListener('scroll', () => {
    const nav = document.getElementById('nav');
    if (window.scrollY > 50) {
        nav?.classList.add('scrolled');
    } else {
        nav?.classList.remove('scrolled');
    }
}, { passive: true });

function initFAQAccordions() {
    document.querySelectorAll('.faq-item').forEach((item, index) => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        if (!question || !answer) return;

        question.type = 'button';
        question.id ||= `faq-question-${index + 1}`;
        answer.id ||= `faq-answer-${index + 1}`;
        question.setAttribute('aria-controls', answer.id);
        answer.setAttribute('role', 'region');
        answer.setAttribute('aria-labelledby', question.id);

        const setExpanded = expanded => {
            question.setAttribute('aria-expanded', String(expanded));
            answer.hidden = !expanded;
            item.classList.toggle('active', expanded);
        };

        setExpanded(item.classList.contains('active'));
        question.addEventListener('click', () => {
            setExpanded(question.getAttribute('aria-expanded') !== 'true');
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFAQAccordions);
} else {
    initFAQAccordions();
}
