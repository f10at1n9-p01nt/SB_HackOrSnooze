$(async function() {
	// cache some selectors we'll be using quite a bit
	const $body = $('body');
	const $allStoriesList = $('#all-articles-list');
	const $articlesContainer = $('.articles-container');
	const $submitForm = $('#submit-form');
	const $filteredArticles = $('#filtered-articles');
	const $loginForm = $('#login-form');
	const $createAccountForm = $('#create-account-form');
	const $ownStories = $('#my-articles');
	const $favoriteArticles = $('#favorited-articles');
	const $navLogin = $('#nav-login');
	const $navLogOut = $('#nav-logout');

	// global storyList variable
	let storyList = null;

	// global currentUser variable
	let currentUser = null;

	await checkIfLoggedIn();

	/**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */

	$loginForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page-refresh on submit

		// grab the username and password
		const username = $('#login-username').val();
		const password = $('#login-password').val();

		// call the login static method to build a user instance
		const userInstance = await User.login(username, password);
		// set the global user to the user instance
		currentUser = userInstance;
		syncCurrentUserToLocalStorage();
		loginAndSubmitForm();
	});

	/**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */

	$createAccountForm.on('submit', async function(evt) {
		evt.preventDefault(); // no page refresh

		// grab the required fields
		let name = $('#create-account-name').val();
		let username = $('#create-account-username').val();
		let password = $('#create-account-password').val();

		// Check if user is in system
		const checkUser = await axios
			.post(`${BASE_URL}/login`, {
				user: {
					username: username,
					password: password
				}
			})
			// if not in system, returns error and new user is created
			.catch(async function(err) {
				if (err.response) {
					// call the create method, which calls the API and then builds a new user instance
					const newUser = await User.create(username, password, name);
					currentUser = newUser;
					syncCurrentUserToLocalStorage();
					loginAndSubmitForm();
					return;
				}
			});
		$('.error-message').text('User already exists!');
	});

	// Log Out Functionality

	$navLogOut.on('click', function() {
		// empty out local storage
		localStorage.clear();
		// refresh the page, clearing memory
		location.reload();
	});

	// Event Handler for Clicking Login

	$navLogin.on('click', function() {
		// Show the Login and Create Account Forms
		$('.error-message').text('');
		$loginForm.slideToggle();
		$createAccountForm.slideToggle();
		$allStoriesList.toggle();
	});

	// Event handler for Navigation to Homepage

	$body.on('click', '#nav-all', async function() {
		hideElements();
		await generateStories();
		$allStoriesList.show();
	});

	// Event handler for clicking Submit in Nav Bar
	$body.on('click', '#nav-submit', function() {
		if (currentUser) {
			// hideElements();
			$submitForm.slideToggle();
		}
	});

	// Event handler clicking Favorites in nav
	$body.on('click', '#nav-favorite', function() {
		// $('#nav-favorite').on('click', function() {
		hideElements();
		if (currentUser) {
			// $('#favorited-articles').slideToggle();
			$favoriteArticles.empty();
			for (let story of currentUser.favorites) {
				$favoriteArticles.append(generateStoryHTML(story));
			}
			$favoriteArticles.show();
		}
	});
	// Event handler clicking My Stories in Nav
	$body.on('click', '#nav-mine', function(evt) {
		hideElements();
		if (currentUser) {
			$allStoriesList.hide();
			$('#my-articles').empty();
			$('#my-articles').slideToggle();
			$('#nav-mine').show();
		}

		for (story of currentUser.ownStories) {
			$('#my-articles').append(generateStoryHTML(story, 'filter'));
		}
	});

	$submitForm.on('submit', async function(evt) {
		// Grab field data
		evt.preventDefault();
		const newStory = {
			author: $('#author').val(),
			title: $('#title').val(),
			url: $('#url').val()
		};
		const userSubmittedStory = await storyList.addStory(currentUser, newStory);

		const markUp = generateStoryHTML(userSubmittedStory);
		$allStoriesList.prepend(markUp);
		$submitForm.slideToggle();
		$submitForm.trigger('reset');
	});

	// Listener on favorite icon
	$articlesContainer.on('click', '.fa-heart', async function(evt) {
		if (currentUser) {
			evt.preventDefault();
			const hrtElement = evt.target;
			const favStory = evt.target.closest('li');

			if ($(hrtElement).hasClass('far')) {
				await currentUser.addFavorite(favStory.id);
				$(hrtElement).toggleClass('far fas');
			} else {
				await currentUser.removeFavorite(favStory.id);
				$(hrtElement).toggleClass('fas far');
			}
		}
	});

	// LIstener on trash icon
	$articlesContainer.on('click', '.fa-trash', async function(evt) {
		if (currentUser) {
			evt.preventDefault();
			const deleteStory = evt.target.closest('li');
			await storyList.deleteStory(currentUser, deleteStory.id);

			await generateStories();
			hideElements();
			$allStoriesList.show();
		}
	});

	/**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */

	async function checkIfLoggedIn() {
		// let's see if we're logged in
		const token = localStorage.getItem('token');
		const username = localStorage.getItem('username');

		// if there is a token in localStorage, call User.getLoggedInUser
		//  to get an instance of User with the right details
		//  this is designed to run once, on page load
		currentUser = await User.getLoggedInUser(token, username);
		await generateStories();

		if (currentUser) {
			showNavForLoggedInUser();
		}
	}

	/**
   * A rendering function to run to reset the forms and hide the login info
   */

	function loginAndSubmitForm() {
		// hide the forms for logging in and signing up
		$loginForm.hide();
		$createAccountForm.hide();

		// reset those forms
		$loginForm.trigger('reset');
		$createAccountForm.trigger('reset');

		// show the stories
		$allStoriesList.show();

		// update the navigation bar
		showNavForLoggedInUser();
	}

	/**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */

	async function generateStories() {
		// get an instance of StoryList
		const storyListInstance = await StoryList.getStories();
		// update our global variable
		storyList = storyListInstance;
		// empty out that part of the page
		$allStoriesList.empty();

		// loop through all of our stories and generate HTML for them
		for (let story of storyList.stories) {
			const result = generateStoryHTML(story);
			$allStoriesList.append(result);
		}
	}

	// Got idea to use function to determine correct class for HTML rendering from key
	function isFavorite(story) {
		if (currentUser) {
			if (currentUser.favorites.length === 0) {
				return 'far';
			}
			for (favStory of currentUser.favorites) {
				if (favStory.storyId === story.storyId) {
					return 'fas';
				}
			}
			return 'far';
		}
	}

	function isOwn(story) {
		if (currentUser) {
			if (currentUser.ownStories.length === 0) {
				return false;
			}
			for (chosenStory of currentUser.ownStories) {
				if (chosenStory.storyId === story.storyId) {
					return true;
				}
			}
			return false;
		}
	}

	function generateStoryHTML(story, context) {
		let hostName = getHostName(story.url);
		let favClass = isFavorite(story);

		if (!currentUser) {
			iconClass = 'far fa-heart';
		} else if (isOwn(story) && context === 'filter') {
			iconClass = 'fas fa-trash';
		} else {
			iconClass = `${favClass} fa-heart`;
		}

		// render story markup
		const storyMarkup = $(`
      	<li id="${story.storyId}">
        <span class="fav-icon">
          <i class="${iconClass}"></i>
        <span/>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

		return storyMarkup;
	}

	/* hide all elements in elementsArr */

	function hideElements() {
		const elementsArr = [
			$submitForm,
			$allStoriesList,
			$filteredArticles,
			$ownStories,
			$loginForm,
			$createAccountForm,
			$favoriteArticles
		];
		elementsArr.forEach(($elem) => $elem.hide());
	}

	function showNavForLoggedInUser() {
		$navLogin.hide();
		$navLogOut.show();
		$('#user-profile').hide(); // Is this good place to add?
	}

	/* simple function to pull the hostname from a URL */

	function getHostName(url) {
		let hostName;
		if (url.indexOf('://') > -1) {
			hostName = url.split('/')[2];
		} else {
			hostName = url.split('/')[0];
		}
		if (hostName.slice(0, 4) === 'www.') {
			hostName = hostName.slice(4);
		}
		return hostName;
	}

	/* sync current user information to localStorage */

	function syncCurrentUserToLocalStorage() {
		if (currentUser) {
			localStorage.setItem('token', currentUser.loginToken);
			localStorage.setItem('username', currentUser.username);
		}
	}
});
