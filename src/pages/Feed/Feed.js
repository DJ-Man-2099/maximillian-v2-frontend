import React, { Component, Fragment } from "react";
import { io } from "socket.io-client";

import Post from "../../components/Feed/Post/Post";
import Button from "../../components/Button/Button";
import FeedEdit from "../../components/Feed/FeedEdit/FeedEdit";
import Input from "../../components/Form/Input/Input";
import Paginator from "../../components/Paginator/Paginator";
import Loader from "../../components/Loader/Loader";
import ErrorHandler from "../../components/ErrorHandler/ErrorHandler";
import "./Feed.css";
import { server } from "../../util/consts";

class Feed extends Component {
	state = {
		isEditing: false,
		posts: [],
		totalPosts: 0,
		editPost: null,
		status: "",
		postPage: 1,
		postsLoading: true,
		editLoading: false,
	};

	componentDidMount() {
		const graphqlQuery = {
			query: `
			query {
				getStatus
			}
			`,
		};
		fetch(`${server}/graphql`, {
			method: "POST",
			body: JSON.stringify(graphqlQuery),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.props.token}`,
			},
		})
			.then((res) => {
				if (res.status !== 200) {
					throw new Error("Failed to fetch user status.");
				}
				return res.json();
			})
			.then((resData) => {
				console.log(resData);
				this.setState({ status: resData.data.getStatus });
			})
			.catch(this.catchError);

		this.loadPosts();
		const socket = io(`${server}`);
		socket.on("posts", (data) => {
			console.log("Event emitted");
			console.log(data);
			if (data.action === "create") {
				this.addPost(data.post);
			} else if (data.action === "update") {
				console.log("Updating....");
				this.updatePost(data.post);
			} else if (data.action === "delete") {
				this.loadPosts();
			}
		});
	}

	addPost = (post) => {
		this.setState((prevState) => {
			const updatedPosts = [...prevState.posts];
			if (prevState.postPage === 1) {
				updatedPosts.pop();
				updatedPosts.unshift(post);
			}
			return {
				posts: updatedPosts,
				totalPosts: prevState.totalPosts + 1,
			};
		});
	};

	updatePost = (post) => {
		this.setState((prevState) => {
			const updatedPosts = [...prevState.posts];
			const updatedPostIndex = updatedPosts.findIndex(
				(p) => p._id === post._id.toString()
			);
			if (updatedPostIndex > -1) {
				updatedPosts[updatedPostIndex] = post;
			}
			return {
				posts: updatedPosts,
			};
		});
	};

	deletePost = (post) => {
		this.setState((prevState) => {
			const updatedPosts = [...prevState.posts];
			const updatedPostIndex = updatedPosts.findIndex(
				(p) => p._id === post._id
			);
			if (updatedPostIndex > -1) {
				updatedPosts.splice(updatedPostIndex, 1);
			}
			return {
				posts: updatedPosts,
			};
		});
	};

	loadPosts = (direction) => {
		if (direction) {
			this.setState({ postsLoading: true, posts: [] });
		}
		let page = this.state.postPage;
		if (direction === "next") {
			page++;
			this.setState({ postPage: page });
		}
		if (direction === "previous") {
			page--;
			this.setState({ postPage: page });
		}
		const graphqlQuery = {
			query: `
			query {
				getPosts(limit: 2, page: ${page}) {
				  posts {
					_id
				  title
				  content
				  imageUrl
				  creator {
				  _id
				  name
				  }
				  createdAt
				  updatedAt
				}
				totalItems
				}
			  }
			`,
		};
		fetch(`${server}/graphql`, {
			method: "POST",
			body: JSON.stringify(graphqlQuery),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.props.token}`,
			},
		})
			.then((res) => {
				if (res.status !== 200) {
					throw new Error("Failed to fetch posts.");
				}
				return res.json();
			})
			.then((resData) => {
				this.setState({
					posts: resData.data.getPosts.posts.map((post) => {
						return {
							...post,
							imagePath: post.imageUrl,
						};
					}),
					totalPosts: resData.data.getPosts.totalItems,
					postsLoading: false,
				});
			})
			.catch(this.catchError);
	};

	statusUpdateHandler = (event) => {
		event.preventDefault();
		console.log(this.state);
		console.log(this.state.status);
		const graphqlQuery = {
			query: `mutation {
				updateStatus(status: "${this.state.status}") 
			  }`,
		};
		fetch(`${server}/graphql`, {
			method: "POST",
			body: JSON.stringify(graphqlQuery),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.props.token}`,
			},
		})
			.then((res) => {
				if (res.status !== 200 && res.status !== 201) {
					throw new Error("Can't update status!");
				}
				return res.json();
			})
			.then((resData) => {
				console.log(resData);
			})
			.catch(this.catchError);
	};

	newPostHandler = () => {
		this.setState({ isEditing: true });
	};

	startEditPostHandler = (postId) => {
		this.setState((prevState) => {
			const loadedPost = { ...prevState.posts.find((p) => p._id === postId) };

			return {
				isEditing: true,
				editPost: loadedPost,
			};
		});
	};

	cancelEditHandler = () => {
		this.setState({ isEditing: false, editPost: null });
	};

	finishEditHandler = async (postData) => {
		this.setState({
			editLoading: true,
		});
		// Set up data (with image!)
		let imageUrl;
		const formData = new FormData();
		formData.append("image", postData.image);
		if (postData.image instanceof File) {
			try {
				const imageData = await (
					await fetch(`${server}/uploadImage`, {
						method: "POST",
						body: formData,
						headers: {
							Authorization: `Bearer ${this.props.token}`,
						},
					})
				).json();
				imageUrl = imageData.imageUrl;
			} catch (err) {
				console.log(err);
				this.setState({
					isEditing: false,
					editPost: null,
					editLoading: false,
					error: err,
				});
			}
		}
		const url = `${server}/graphql`;
		const method = "POST";
		let editPart = "isNew: true,";
		if (this.state.editPost) {
			editPart = `
			isNew: false,
			postId: ${this.state.editPost._id},
			`;
		}
		const graphqlQuery = {
			query: `mutation {
				upsertPost(postInput: {
					title: "${postData.title}", 
					content: "${postData.content}",
					${imageUrl ? `imageUrl: "${imageUrl}"` : ""},
					${editPart}}) {
				  _id
				  title
				  content
				  imageUrl
				  creator {
					_id
					name
				  }
				  createdAt
				  updatedAt
				}
			  }`,
		};

		try {
			const res = await fetch(url, {
				method: method,
				body: JSON.stringify(graphqlQuery),
				headers: {
					Authorization: `Bearer ${this.props.token}`,
					"Content-Type": "application/json",
				},
			});

			const resData = await res.json();

			const post = resData.data.upsertPost;
			console.log(post);
			if (resData.errors && resData.errors[0].status === 442) {
				throw new Error("Validation Failed");
			}
			if (resData.errors) {
				throw new Error("Post Create/Update Failed");
			}
			this.setState(() => {
				return {
					isEditing: false,
					editPost: null,
					editLoading: false,
				};
			});
		} catch (err) {
			console.log(err);
			this.setState({
				isEditing: false,
				editPost: null,
				editLoading: false,
				error: err,
			});
		}
	};

	statusInputChangeHandler = (input, value) => {
		this.setState({ status: value });
	};

	deletePostHandler = (postId) => {
		this.setState({ postsLoading: true });
		const graphqlQuery = {
			query: `mutation delete($postId: Int!) {
				deletePost(postId: $postId) 
			  }`,
			variables: {
				postId: parseInt(postId),
			},
		};
		fetch(`${server}/graphql`, {
			method: "POST",
			body: JSON.stringify(graphqlQuery),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.props.token}`,
			},
		})
			.then((res) => {
				if (res.status !== 200 && res.status !== 201) {
					throw new Error("Deleting a post failed!");
				}
				return res.json();
			})
			.then((resData) => {
				console.log(resData);
				/* this.loadPosts(); */
			})
			.catch((err) => {
				console.log(err);
				this.setState({ postsLoading: false });
			});
	};

	errorHandler = () => {
		this.setState({ error: null });
	};

	catchError = (error) => {
		this.setState({ error: error });
	};

	render() {
		return (
			<Fragment>
				<ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
				<FeedEdit
					editing={this.state.isEditing}
					selectedPost={this.state.editPost}
					loading={this.state.editLoading}
					onCancelEdit={this.cancelEditHandler}
					onFinishEdit={this.finishEditHandler}
				/>
				<section className="feed__status">
					<form onSubmit={this.statusUpdateHandler}>
						<Input
							type="text"
							placeholder="Your status"
							control="input"
							onChange={this.statusInputChangeHandler}
							value={this.state.status}
						/>
						<Button mode="flat" type="submit">
							Update
						</Button>
					</form>
				</section>
				<section className="feed__control">
					<Button mode="raised" design="accent" onClick={this.newPostHandler}>
						New Post
					</Button>
				</section>
				<section className="feed">
					{this.state.postsLoading && (
						<div style={{ textAlign: "center", marginTop: "2rem" }}>
							<Loader />
						</div>
					)}
					{this.state.posts.length <= 0 && !this.state.postsLoading ? (
						<p style={{ textAlign: "center" }}>No posts found.</p>
					) : null}
					{!this.state.postsLoading && (
						<Paginator
							onPrevious={this.loadPosts.bind(this, "previous")}
							onNext={this.loadPosts.bind(this, "next")}
							lastPage={Math.ceil(this.state.totalPosts / 2)}
							currentPage={this.state.postPage}
						>
							{this.state.posts.map((post) => (
								<Post
									key={post._id}
									id={post._id}
									author={post.creator.name}
									date={new Date(post.createdAt).toLocaleDateString("en-US")}
									title={post.title}
									image={post.imageUrl}
									content={post.content}
									onStartEdit={this.startEditPostHandler.bind(this, post._id)}
									onDelete={this.deletePostHandler.bind(this, post._id)}
								/>
							))}
						</Paginator>
					)}
				</section>
			</Fragment>
		);
	}
}

export default Feed;
