new Vue({
	el: '#app',
	data: {
		activeCountry: '',
		activeCountryStats: null,
		globalStats: null,
		chartPoints: '',
		countries: null,
		date: null,
		duplicateCountries: [
			'Bahamas, The',
			'Gambia, The',
			'Hong Kong SAR',
			'Iran (Islamic Republic of)',
			'Korea, South',
			'Republic of Korea',
			'Republic of the Congo',
			'The Bahamas',
			'occupied Palestinian territory',
		],
		filteredCountries: null,
		isLoading: false,
		isIE11: false,
		months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		query: '',
		start: '23 Jan',
		sort: 'TotalConfirmed',
		url: 'https://api.covid19api.com/',
	},
	created() {
		this.init();
	},
	methods: {
		init() {
			this.isIE11 = !!window.MSInputMethodContext && !!document.documentMode;

			// @todo update active country from live source
			//this.checkLiveConfirmed();

			// Get a local stored copy
			var localData = localStorage.getItem('covid_stats');
			//var localData = '';
			if (localData) {
				localData = JSON.parse(localData);

				if (localData.ActiveCountry) {
					this.activeCountry = localData.ActiveCountry;
				} else {
					this.setActiveCountry();
				}

				if (localData.ActiveCountryChart) {
					this.chartPoints = localData.ActiveCountryChart;
					this.start = localData.ActiveCountryChartStart;
				}

				var lastFetchTime = new Date(localData.LastFetch).getTime();
				var last15mins = new Date().getTime() - 1000 * 60 * 15;

				if (lastFetchTime < last15mins) {
					this.fetchData();
				} else {
					// Refresh if last fetch was over 15mins ago
					this.setData(localData);
					this.setActiveCountryStats();
				}
			} else {
				this.fetchData();
			}
		},
		filterCountries() {
			var q = this.query.split(',');

			this.filteredCountries = this.countries.filter(country => {
				for (var i = q.length - 1; i >= 0; i--) {
					if (q[i].trim() != '' && country.Slug.indexOf(q[i].trim().toLowerCase()) != -1) {
						return country;
					}
				}
			});
		},
		fetchData() {
			this.countries = null;
			this.filteredCountries = null;
			this.isLoading = true;

			fetch(this.url + 'summary')
				.then(res => res.json())
				.then(data => {
					this.isLoading = false;

					this.globalStats = {
						TotalConfirmed: 0,
						TotalDeaths: 0,
						TotalRecovered: 0,
					};

					data.Countries = data.Countries.filter(country => {
						if (
							country.Country.trim() != '' &&
							!this.duplicateCountries.includes(country.Country)
						) {
							// give US a new slug
							if (country.Slug == 'us') {
								country.Country = 'United States';
								country.Slug = 'united-states-us';
							}

							this.globalStats.TotalConfirmed += country.TotalConfirmed;
							this.globalStats.TotalDeaths += country.TotalDeaths;
							this.globalStats.TotalRecovered += country.TotalRecovered;

							return country;
						}
					});

					data.LastFetch = new Date();
					data.ActiveCountry = this.activeCountry;
					data.globalStats = this.globalStats;

					localStorage.setItem('covid_stats', JSON.stringify(data));
					this.setData(data);

					this.setActiveCountry();
				});
		},
		fetchActiveCountryHistory() {
			fetch(this.url + 'total/country/' + this.activeCountry + '/status/confirmed')
				.then(res => res.json())
				.then(data => {
					if (data.length > 0) {
						this.buildChart(data);

						var localData = JSON.parse(localStorage.getItem('covid_stats'));
						localData.ActiveCountryChart = this.chartPoints;
						localData.ActiveCountryChartStart = this.start;
						localStorage.setItem('covid_stats', JSON.stringify(localData));
					}
				});
		},
		setData(data) {
			this.date = data.Date;
			this.countries = data.Countries;
			this.globalStats = data.globalStats;
			this.filteredCountries = this.countries;

			// Sort by URL param
			var urlParams = new URLSearchParams(window.location.search);
			var sort = urlParams.get('sort');

			if (sort) {
				var sortOption = '';

				if (sort == 'cases') {
					sortOption = 'TotalConfirmed';
				}

				if (sort == 'deaths') {
					sortOption = 'TotalDeaths';
				}

				this.sort = sortOption;
			}

			this.filteredCountries = this.sortBy(this.sort, this.countries);
		},
		setActiveCountry() {
			fetch('https://ipapi.co/json/')
				.then(res => res.json())
				.then(data => {
					if (data.country_name) {
						this.activeCountry = data.country_name.toLowerCase();

						var localData = JSON.parse(localStorage.getItem('covid_stats'));
						localData.ActiveCountry = this.activeCountry;
						localStorage.setItem('covid_stats', JSON.stringify(localData));

						this.setActiveCountryStats();
						this.fetchActiveCountryHistory();
					}
				});
		},
		checkLiveConfirmed() {
			fetch(this.url + '/live/country/australia/status/confirmed')
				.then(res => res.json())
				.then(data => {
					var sortedData = this.sortBy('Date', data);
					var sum = data.reduce(function(a, b) {
						return a + b.Cases;
					}, 0);
				});
		},
		setActiveCountryStats() {
			// Get your country
			this.activeCountryStats = this.countries.find(country => country.Slug === this.activeCountry);
		},
		buildChart(data) {
			Array.prototype.scaleBetween = function(scaledMin, scaledMax) {
				var max = Math.max.apply(Math, this);
				var min = Math.min.apply(Math, this);
				return this.map(num =>
					(100 - ((scaledMax - scaledMin) * (num - min)) / (max - min) + scaledMin).toFixed(2)
				);
			};

			this.chartPoints = '';

			var start = new Date(data[0].Date);
			this.start = start.getDate() + ' ' + this.months[start.getMonth()];

			/*var end = new Date(data[data.length - 1].Date);
			this.end = end.getDate() + ' ' + this.months[end.getMonth()];*/

			var y = data.map(point => point.Cases);
			var scaledY = y.scaleBetween(0, 100);
			var lenY = scaledY.length;

			for (var i = 0; i <= lenY - 1; i++) {
				this.chartPoints += (i * 500) / lenY + ',' + scaledY[i] + ' ';
			}
		},
		scaleBetween(unscaled, minAllowed, maxAllowed, min, max) {
			return ((maxAllowed - minAllowed) * (unscaled - min)) / (max - min) + minAllowed;
		},
		sortBy(field, arr = null) {
			if (!arr) {
				arr = this.countries;
			}

			this.sort = field ? field : 'Country';

			arr.sort((a, b) =>
				b[field] > a[field] ? 1 : b[field] === a[field] ? (a.Country > b.Country ? 1 : -1) : -1
			);

			return arr;
		},
	},
	filters: {
		deathsPercent(deaths, total) {
			var percent = deaths / total;
			return percent > 0.01 ? Math.round(percent * 1000) / 10 + '%' : '<1%';
		},
		numberWithCommas(number = 0) {
			return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		},
		prettyDate(time) {
			var date = new Date(time);
			var diff = (new Date().getTime() - date.getTime()) / 1000;
			var day_diff = Math.floor(diff / 86400);

			if (isNaN(day_diff) || day_diff < 0 || day_diff >= 31) return;

			return (
				(day_diff == 0 &&
					((diff < 60 && 'just now') ||
						(diff < 120 && '1 minute ago') ||
						(diff < 3600 && Math.floor(diff / 60) + ' minutes ago') ||
						(diff < 7200 && '1 hour ago') ||
						(diff < 86400 && Math.floor(diff / 3600) + ' hours ago'))) ||
				(day_diff == 1 && 'Yesterday') ||
				(day_diff < 7 && day_diff + ' days ago') ||
				(day_diff < 31 && Math.ceil(day_diff / 7) + ' weeks ago')
			);
		},
	},
});
