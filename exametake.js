let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let incorrectAnswers = [];
let cheatingAttempts = 0;
let selectedOptions = [];
let quizFinished = false;
let cheatingDetected = false;
let showingCorrectAnswer = false;
let timerInterval; // Variable to store the timer interval
let timeLeft;
let MAX_CHEATING_ATTEMPTS = 3;
let exameName = '';

const exameTitleElement = document.getElementById('title');
const questionElement = document.getElementById('question');
const optionsContainer = document.getElementById('options-container');
const nextButton = document.getElementById('next-button');
const prevButton = document.getElementById('prev-button');
const finishButton = document.getElementById('finish-button');
const resultContainer = document.getElementById('result-container');
const scoreElement = document.getElementById('score');
const respondList = document.getElementById('respond-list');
const quizContainer = document.getElementById('quiz-container');
const progressText = document.getElementById('progress-text');
const cheatingWarning = document.getElementById('cheating-warning');
const finalCheatingAttemptsElement = document.getElementById('final-cheating-attempts');
const downloadPdfButton = document.getElementById('downloadPdfButton');
const navigationContainer = document.getElementById('navigation-container');
const flagButton = document.getElementById('flag-button');
const timerDisplay = document.getElementById('timer'); // Element to display the timer


async function initializeQuiz() {
    try {
        exameName = getUrlParameter("exameName");
        const numQuestionsParam = getUrlParameter("numQuestions");
        let numQuestions = numQuestionsParam ? parseInt(numQuestionsParam) : null;
        const shuffleOptionsParam = getUrlParameter("shuffleOptions");
        const shuffleOptions = shuffleOptionsParam === "true";
        const timeLimitParam = getUrlParameter("timeLimit");
        let timeLimit = timeLimitParam ? parseInt(timeLimitParam*60000) : null;
        MAX_CHEATING_ATTEMPTS = getUrlParameter("CheatingAttempts") ?  getUrlParameter("CheatingAttempts") :3;

        if (!exameName) {
            questionElement.textContent = "Error: 'exameName' parameter is missing in the URL.";
            quizContainer.style.display = 'none';
            return;
        }

        const response = await fetch(`JsonExames/${exameName}.json`);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        exameTitleElement.innerText = exameName;

        const maxQuestionsAvailable = data.length;
        if (!numQuestions || numQuestions > maxQuestionsAvailable) {
            numQuestions = maxQuestionsAvailable;
        }

        questions = selectRandomQuestions(data, numQuestions);

        if (shuffleOptions) {
            questions.forEach(question => {
                question.options = shuffleArray(question.options);
            });
        }

        questions.forEach(question => {
            question.markedIncorrect = [];
            question.flagged = false; // Initialize the flagged property
        });

        selectedOptions = new Array(questions.length).fill(null);
        createNavigationButtons(); // Initialize the navigation buttons
        startQuiz(timeLimit);
    } catch (error) {
        console.error('Error loading quiz data:', error);
        questionElement.textContent = 'Error loading the exam. Please try again later.';
        quizContainer.style.display = 'none';
    }
}

function selectRandomQuestions(allQuestions, num) {
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function getUrlParameter(name) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    } catch (error) {
        console.error("Error parsing URL parameters:", error);
        return null;
    }
}

function startQuiz(timeLimit) {
    currentQuestionIndex = 0;
    score = 0;
    cheatingAttempts = 0;
    selectedOptions = new Array(questions.length).fill(null);
    questions.forEach(question => {
        question.markedIncorrect = [];
        question.flagged = false; // Ensure flags are reset when restarting
    });
    respondList.innerHTML = "";
    resultContainer.style.display = 'none';
    quizContainer.style.display = 'block';
    cheatingWarning.style.display = 'none';
    quizFinished = false;
    cheatingDetected = false;
    updateNavigationButtonStyles(); // Highlight the current question's button
    showQuestion();

    // Start the timer if a time limit is provided
    if (timeLimit) {
        timeLeft = timeLimit; // Set the initial time left
        startTimer(timeLimit);
    }
}

function showQuestion() {
    if (quizFinished || cheatingAttempts >= MAX_CHEATING_ATTEMPTS) {
        return;
    }

    if (currentQuestionIndex >= questions.length) {
        finishQuiz();
        return;
    }

    const question = questions[currentQuestionIndex];
    questionElement.textContent = question.question;
    optionsContainer.innerHTML = '';

    if (question.image) {
        const imageElement = document.createElement('img');
        imageElement.src = question.image;
        imageElement.classList.add('question-image');
        imageElement.alt = "Question Image";
        questionElement.appendChild(imageElement);
    }

    question.options.forEach((option, index) => {
        const optionButton = document.createElement('button');
        const letter = String.fromCharCode(65 + index);
        optionButton.textContent = `${letter}. ${option.text}`;
        optionButton.classList.add('option-button');

        if (selectedOptions[currentQuestionIndex] === option) {
            optionButton.classList.add('selected-answer');
        }

        // Add contextmenu event listener to toggle "possible-incorrect" class
        optionButton.addEventListener('contextmenu', function (event) {
            event.preventDefault(); // Prevent default context menu
            const optionIndex = index;
            if (optionIndex !== -1) {
                if (isOptionMarkedIncorrect(optionIndex)) {
                    removeOptionFromMarkedIncorrect(optionIndex);
                    optionButton.classList.remove('possible-incorrect');
                } else {
                    addOptionToMarkedIncorrect(optionIndex);
                    optionButton.classList.add('possible-incorrect');
                }
            }
        });

        if (isOptionMarkedIncorrect(index)) {
            optionButton.classList.add('possible-incorrect');
        }

        optionButton.addEventListener('click', () => selectAnswer(optionButton, option));
        optionsContainer.appendChild(optionButton);
    });

    updateButtonVisibility();
    updateProgress();
    updateNavigationButtonStyles();

    const flagButton = document.getElementById('flag-button');
    flagButton.dataset.questionIndex = currentQuestionIndex;
    flagButton.onclick = () => toggleFlag(flagButton.dataset.questionIndex);

    // Toggle flag icon class
    if (question.flagged) {
        flagButton.classList.add('active');
    } else {
        flagButton.classList.remove('active');
    }

    // Disable Next button if on the last question
    if (currentQuestionIndex === questions.length - 1) {
        nextButton.disabled = true;
    } else {
        nextButton.disabled = false;
    }
}

function selectAnswer(button, selectedOption) {
    const optionButtons = optionsContainer.querySelectorAll('.option-button');
    optionButtons.forEach(btn => btn.classList.remove('selected-answer'));

    button.classList.add('selected-answer');
    selectedOptions[currentQuestionIndex] = selectedOption;
}

function updateButtonVisibility() {
    prevButton.disabled = currentQuestionIndex === 0;
    nextButton.disabled = currentQuestionIndex === questions.length - 1;
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        finishQuiz();
    }
}

function finishQuiz() {
    clearInterval(timerInterval); // Stop the timer
    quizFinished = true;
    calculateResults();
    showResults();
}

function calculateResults() {
    score = 0;
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const selectedOption = selectedOptions[i];

        if (selectedOption && selectedOption.isCorrect) {
            score++;
        }
    }
}

function showResults() {
  
    quizContainer.style.display = 'none';
    navigationContainer.style.display = 'none';
    resultContainer.style.display = 'block';
    clearInterval(timerInterval); // Stop the timer

    if (cheatingDetected) {
        scoreElement.textContent = "Quiz terminated due to excessive cheating attempts. Your score will not be calculated.";
        respondList.innerHTML = "";
    } else {
        const percentage = (score / questions.length) * 100;
        scoreElement.textContent = percentage.toFixed(2) + "%";

        respondList.innerHTML = "";

        questions.forEach((question, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<p><strong>${index + 1}) Question:</strong> ${question.question}</p>`;

            const selectedOption = selectedOptions[index];
            const correctAnswer = question.options.find(opt => opt.isCorrect);

            if (!selectedOption) {
                listItem.innerHTML += `<p class="not-answered">Not Answered</p>`;
            }

            question.options.forEach((option, optionIndex) => {
                const letter = String.fromCharCode(65 + optionIndex);
                let optionClass = '';
                if (option === selectedOption && option === correctAnswer) {
                    optionClass = 'correct-answer';
                } else if (selectedOption === option) {
                    optionClass = 'incorrect-answer';
                } else if (option === correctAnswer) {
                    optionClass = 'correct-answer';
                }

                if (isOptionMarkedIncorrect(optionIndex)) {
                    optionClass += ' possible-incorrect';
                }

                listItem.innerHTML += `<p class="${optionClass}">${letter}. ${option.text}</p>`;
            });

            console.log(listItem);
            respondList.appendChild(listItem);
        });
    }

    finalCheatingAttemptsElement.textContent = cheatingAttempts;

    downloadPdfButton.textContent = 'Download Results (PDF)';
    downloadPdfButton.classList.add('nav-button');
    downloadPdfButton.addEventListener('click', generateAndDownloadPdf);
    resultContainer.appendChild(downloadPdfButton); 
}

function updateProgress() {
    progressText.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
}

document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        cheatingAttempts++;
        cheatingWarning.textContent = `Warning! Cheating attempt detected (${cheatingAttempts}/${MAX_CHEATING_ATTEMPTS}).`;
        cheatingWarning.style.display = 'block';
        console.warn("User attempted to switch tabs/applications!");
    } else {
        setTimeout(() => {
            cheatingWarning.style.display = 'none';
        }, 3000);
    }

    if (cheatingAttempts >= MAX_CHEATING_ATTEMPTS) {
        cheatingDetected = true;
        questionElement.textContent = "Quiz terminated due to excessive cheating attempts!";
        optionsContainer.innerHTML = "";
        nextButton.style.display = 'none';
        prevButton.style.display = 'none';
        finishButton.style.display = 'none';
        finishQuiz();
    }
});

document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        showingCorrectAnswer = true;
        showCorrectAnswer();
    }
});

document.addEventListener('keyup', function (event) {
    if (!(event.ctrlKey && event.shiftKey && event.key === 'A') && showingCorrectAnswer) {
        showingCorrectAnswer = false;
        showQuestion();
    }
});

function showCorrectAnswer() {
    const question = questions[currentQuestionIndex];
    const correctOption = question.options.find(opt => opt.isCorrect);

    const optionButtons = optionsContainer.querySelectorAll('.option-button');
    optionButtons.forEach(button => {
        const letter = button.textContent.charAt(0);
        const optionText = button.textContent.substring(3);

        if (correctOption && optionText === correctOption.text) {
            button.classList.add('correct-answer');
        } else {
            button.classList.remove('correct-answer');
        }
    });
}

function isOptionMarkedIncorrect(optionIndex) {
    const question = questions[currentQuestionIndex];
    return question.markedIncorrect?.includes(optionIndex) || false;
}

function addOptionToMarkedIncorrect(optionIndex) {
    const question = questions[currentQuestionIndex];
    if (!question.markedIncorrect) {
        question.markedIncorrect = [];
    }
    question.markedIncorrect.push(optionIndex);
}

function removeOptionFromMarkedIncorrect(optionIndex) {
    const question = questions[currentQuestionIndex];
    question.markedIncorrect = question.markedIncorrect?.filter(index => index !== optionIndex) || [];
}

function createNavigationButtons() {
    navigationContainer.innerHTML = ''; // Clear existing buttons

    for (let i = 0; i < questions.length; i++) {
        const button = document.createElement('button');
        button.textContent = i + 1;
        button.classList.add('navigation-button');
        button.dataset.questionIndex = i; // Store the question index
        button.addEventListener('click', () => {
            currentQuestionIndex = i;
            showQuestion();
        });

        navigationContainer.appendChild(button);
    }
    updateNavigationButtonStyles();
}

function updateNavigationButtonStyles() {
    const navButtons = navigationContainer.querySelectorAll('.navigation-button');
    navButtons.forEach((button, index) => {
        if (index === currentQuestionIndex) {
            button.classList.add('current-question');
        } else {
            button.classList.remove('current-question');
        }

        // Update flag based on question's flag state
        if (questions[index].flagged) {
            button.classList.add('flagged');
        } else {
            button.classList.remove('flagged');
        }
    });
}

function toggleFlag() {
    const question = questions[currentQuestionIndex];
    question.flagged = !question.flagged;
    const flagButton = document.getElementById('flag-button');
    if (question.flagged) {
        flagButton.classList.add('active');
    } else {
        flagButton.classList.remove('active');
    }
    showQuestion();
    updateNavigationButtonStyles();
}

function startTimer(duration) {
    let timer = duration / 1000; // Convert milliseconds to seconds

    timerInterval = setInterval(function () {
        let hours = Math.floor(timer / 3600);
        let minutes = Math.floor((timer % 3600) / 60);
        let seconds = timer % 60;

        hours = hours < 10 ? "0" + hours : hours;
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        timerDisplay.textContent = hours + ":" + minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(timerInterval);
            finishQuiz(); // Automatically finish the quiz
        }
    }, 1000);
}


nextButton.addEventListener('click', nextQuestion);
prevButton.addEventListener('click', prevQuestion);
finishButton.addEventListener('click', finishQuiz);

function generateAndDownloadPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(exameName +  ' - Quiz Results (' + score +'%)', 10, 10);

    let y = 20;
    const lineHeight = 10;
    const margin = 10;
    const pageHeight = doc.internal.pageSize.getHeight() - margin;
    const maxLinesPerPage = 50;
    let currentLine = 0;

    function addText(text, x, y, color) {
        const textLines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - 2 * margin);
        const numLines = textLines.length;

        if (currentLine + numLines > maxLinesPerPage) {
            doc.addPage();
            y = margin;
            currentLine = 0;
        }

        if (color) {
            doc.setTextColor(color[0], color[1], color[2]);
        }
        doc.text(textLines, x, y);
        doc.setTextColor(0);
        currentLine += numLines;
        return y + numLines * lineHeight;
    }

    questions.forEach((question, index) => {
        let yPos = y;
        doc.setFontSize(12);
        yPos = addText(`Question ${index + 1}: ${question.question}`, margin, yPos);

        const selectedOption = selectedOptions[index];
        const correctAnswer = question.options.find(opt => opt.isCorrect);

        question.options.forEach((option, optionIndex) => {
            const letter = String.fromCharCode(65 + optionIndex);
            let optionText = `${option.text}`;
            let color = null;
			let isStrike = false;

			if (question.markedIncorrect?.includes(optionIndex)) {
				isStrike = true;
			}

            if (selectedOption === option && option === correctAnswer) {
                color = [0, 128, 0];
            } else if (selectedOption === option) {
                color = [255, 0, 0];
            } else if (option === correctAnswer) {
                color = [0, 0, 255];
            }

            doc.setFontSize(10);
			let fullOptionText = ` ${letter}. ${optionText}`;
			if (isStrike) {
				fullOptionText = ` (Strike) ${fullOptionText }`
			}
            yPos = addText(fullOptionText, margin + 5, yPos, color);
        });
        if (!selectedOption) {
          yPos = addText(` Not Answered`, margin + 5, yPos, [128,128,128]);
        }
        y = yPos + 5;
    });

    doc.save('quiz_results.pdf');
}

initializeQuiz();