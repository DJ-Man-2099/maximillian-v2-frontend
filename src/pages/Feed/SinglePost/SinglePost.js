import React, { Component } from "react";
import { gql, GraphQLClient } from "graphql-request";

import Image from "../../../components/Image/Image";
import "./SinglePost.css";
import { server } from "../../../util/consts";

const endpoint = `${server}/graphql`;

class SinglePost extends Component {
	state = {
		title: "",
		author: "",
		date: "",
		image: "",
		content: "",
	};

	graphQLClient = new GraphQLClient(endpoint, {
		headers: {
			Authorization: `Bearer ${this.props.token}`,
		},
	});

	componentDidMount() {
		const postId = this.props.match.params.postId;
		const query = gql`
			query {
				getPost(postId: ${postId}) {
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
			}}
		`;
		this.graphQLClient
			.request(query)
			.then((resData) => {
				resData.post = resData.getPost;
				const server = "http://localhost:8080";
				console.log(resData.post);
				this.setState({
					image: `${server}/images/${resData.post.imageUrl}`,
					title: resData.post.title,
					author: resData.post.creator.name,
					date: new Date(resData.post.createdAt).toLocaleDateString("en-US"),
					content: resData.post.content,
				});
			})
			.catch((err) => {
				console.log(err);
			});
	}

	render() {
		return (
			<section className="single-post">
				<h1>{this.state.title}</h1>
				<h2>
					Created by {this.state.author} on {this.state.date}
				</h2>
				<div className="single-post__image">
					<Image contain imageUrl={this.state.image} />
				</div>
				<p>{this.state.content}</p>
			</section>
		);
	}
}

export default SinglePost;
