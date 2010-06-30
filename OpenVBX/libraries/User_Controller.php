<?php
/**
 * "The contents of this file are subject to the Mozilla Public License
 *  Version 1.1 (the "License"); you may not use this file except in
 *  compliance with the License. You may obtain a copy of the License at
 *  http://www.mozilla.org/MPL/
 
 *  Software distributed under the License is distributed on an "AS IS"
 *  basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 *  License for the specific language governing rights and limitations
 *  under the License.

 *  The Original Code is OpenVBX, released June 15, 2010.

 *  The Initial Developer of the Original Code is Twilio Inc.
 *  Portions created by Twilio Inc. are Copyright (C) 2010.
 *  All Rights Reserved.

 * Contributor(s):
 **/

class User_ControllerException extends Exception {}

class User_Controller extends MY_Controller
{
	public $tenant = null;
	protected $user_id;
	protected $section;
	protected $request_method;
	protected $response_type;
	public $twilio_sid;
	public $twilio_token;
	public $twilio_endpoint;
	
	public $testing_mode = false;
	public $domain;
	
	public function __construct()
	{
		// This is to support SWFUpload.  SWFUpload will scrape all cookies via Javascript and send them
		// as POST request params.	This enables the file uploader to work with a proper session.
		foreach ($_POST as $key => $value)
		{
			// Copy any key that looks like an Openvbx session over to $_COOKIE where it's expected
			if (preg_match("/^\d+\-openvbx_session$/", $key))
			{
				$_COOKIE[$key] = urldecode($_POST[$key]);
			}
		}
		
		parent::__construct();

		if(!file_exists(APPPATH . 'config/openvbx.php')
		   || !file_exists(APPPATH . 'config/database.php'))
		{
			redirect('install');
		}
		
		$this->config->load('openvbx');

		// check for required configuration values
		$this->load->database();
		$this->load->library('ErrorMessages');
		$this->load->model('vbx_rest_access');
		$this->load->model('vbx_message');
		
		$this->tenant = $this->settings->get_tenant($this->router->tenant);
		if($this->tenant === false)
		{
			$this->router->tenant = '';
			return redirect('');
		}

		// When we're in testing mode, allow access to set Hiccup configuration
		$this->testing_mode = !empty($_REQUEST['vbx_testing_key'])? $_REQUEST['vbx_testing_key'] == $this->config->item('testing-key') : false;
		$this->config->set_item('sess_cookie_name', $this->tenant->id . '-' . $this->config->item('sess_cookie_name'));
		$this->load->library('session');
		$this->twilio_sid = $this->settings->get('twilio_sid', $this->tenant->id);
		$this->twilio_token = $this->settings->get('twilio_token', $this->tenant->id);
		$this->twilio_endpoint = $this->settings->get('twilio_endpoint', VBX_PARENT_TENANT);
		
		if(!$this->tenant->active)
		{
			$this->session->set_userdata('loggedin', 0);
			$this->session->set_flashdata('error', 'This tenant is no longer active');
			return redirect('auth/logout');
		}


		$keys = array('base_url', 'salt');
		foreach($keys as $key)
		{
			$item[$key] = $this->config->item($key);
			if(empty($item[$key]))
			{
				redirect('install');
			}
		}

		/* Rest API Authentication - one time pass only */
		$singlepass = $this->input->cookie('singlepass');
		if(!empty($singlepass))
		{
			$ra = new VBX_Rest_Access();
			$user_id = $ra->auth_key($singlepass);
			unset($_COOKIE['singlepass']);
			if($user_id)
			{
				$this->session->set_userdata('user_id', $user_id);
				$this->session->set_userdata('loggedin', true);
				$this->session->set_userdata('signature', VBX_User::signature($user_id));
			}
		}
		
		$user_id = $this->session->userdata('user_id');

		/* Signature check */
		if (!empty($user_id))
		{
			$expected_signature = VBX_User::signature($user_id);
			$actual_signature = $this->session->userdata('signature');
			
			if ($expected_signature != $actual_signature)
			{
				$this->session->set_flashdata('error', 'Your session has expired');
				$this->session->set_userdata('loggedin', false);
			}
		}

		if($this->response_type == 'json')
		{
			$this->attempt_digest_auth();
		}
		
		if (!$this->session->userdata('loggedin') && $this->response_type != 'json')
		{
			return redirect('auth/login?redirect='.urlencode(uri_string()));
		}
		
		$this->user_id = $this->session->userdata('user_id');
		$this->set_request_method();

		/* Mark the user as seen */
		if (!empty($this->user_id))
		{
			try
			{
				$user = VBX_User::get($this->user_id);
				$last_seen = $user->last_seen;
				$user->last_seen = new MY_ModelLiteral('UTC_TIMESTAMP()');
				$user->save();
			}
			catch(VBX_UserException $e)
			{
				/* Handle this gracefully, but report the error. */
				error_log($e->getMessage());
			}

			/* Check for updates if an admin */
			if($this->session->userdata('is_admin') && $this->uri->segment(1) != "upgrade")
			{
				$this->upgrade_check();
			}
		}
	}

	protected function redirect($url)
	{
		redirect($url);
	}

	private function upgrade_check()
	{
		$currentSchemaVersion = OpenVBX::schemaVersion();
		$upgradingToSchemaVersion = OpenVBX::getLatestSchemaVersion();
		if($currentSchemaVersion != $upgradingToSchemaVersion)
			redirect('upgrade');
	}

	function digest_parse($digest)
	{
		// protect against missing data
		$needed_parts = array('nonce'=>1, 'nc'=>1, 'cnonce'=>1, 'qop'=>1, 'username'=>1, 'uri'=>1, 'response'=>1);
		$data = array();
		
		preg_match_all('@(\w+)=(?:(?:\'([^\']+)\'|"([^"]+)")|([^\s,]+))@', $digest, $matches, PREG_SET_ORDER);

		foreach ($matches as $m) {
			$data[$m[1]] = $m[2] ? $m[2] : ($m[3] ? $m[3] : $m[4]);
			unset($needed_parts[$m[1]]);
		}

		return $needed_parts ? false : $data;
	}
	

	function attempt_digest_auth() {
		$message = '';

		if(isset($_SERVER['Authorization'])) {
			// Just in case they ever fix Apache to send the Authorization header on, the following code is included
			$headers['Authorization'] = $_SERVER['Authorization'];
		}
		
		if(function_exists('apache_request_headers')) {
			// We are running PHP as an Apache module, so we can get the Authorization header this way
			$headers = apache_request_headers();
		}
		
		if(isset($_SERVER['PHP_AUTH_USER']) && isset($_SERVER['PHP_AUTH_PW'])) {
			// Basic authentication information can be retrieved from these server variables
			$username = $_SERVER['PHP_AUTH_USER'];
			$password = $_SERVER['PHP_AUTH_PW'];
		}
		
		
		if(isset($headers['Authorization'])) {
			$_SERVER['PHP_AUTH_DIGEST'] = $headers['Authorization'];
			$data = $this->digest_parse($_SERVER['PHP_AUTH_DIGEST']);
		}

		$captcha = '';
		if(isset($headers['Captcha']))
		{
			$captcha = $headers['Captcha'];
		}

		$captcha_token = '';
		if(isset($headers['CaptchaToken']))
		{
			$captcha_token = $headers['CaptchaToken'];
		}
		
		if (isset($username)
			&& isset($password))
		{
			log_message('info', 'Authenticating user: '.var_export($username, true));
			
			$u = VBX_User::authenticate($username,
										$password,
										$captcha,
										$captcha_token);
			if($u)
			{
				$next = $this->session->userdata('next');
				$this->session->unset_userdata('next');
				$userdata = array('email' => $u->email,
								  'user_id' => $u->id,
								  'is_admin' => $u->is_admin,
								  'loggedin' => TRUE,
								  'signature' => VBX_User::signature($u->id),
								  );

				$this->session->set_userdata($userdata);
			}
		}

		if(!$this->session->userdata('loggedin'))
		{
			header("WWW-Authenticate: Basic realm=\"OpenVBX\"");
			header("HTTP/1.0 401 Unauthorized");
			exit;
		}

		return $message;
	}

	// make sure this page or function can only be accessed by admins
	function admin_only($page_name = 'this page')
	{
		if (!$this->session->userdata('is_admin')) {
			$this->session->set_userdata('next', uri_string());
			$this->session->set_flashdata('error', "You must be an administrator to access $page_name.");
			redirect('auth/login');
		}
	}

	protected function init_view_data($full_view = true)
	{
		$data = array();
		
		if($full_view)
		{
			$data['counts'] = $counts = $this->message_counts();
		}
		try
		{
			$data['callerid_numbers'] = $this->get_twilio_numbers();
		}
		catch(User_ControllerException $e)
		{
			// $this->session->set_flashdata('error', $e->getMessage());
			error_log($e->getMessage());
		}
		
		$data['user_numbers'] = $this->get_user_numbers();
		$data['error'] = $this->session->flashdata('error');
		if(!empty($data['error']))
			log_message('error', $data['error']);
		$data['section'] = $this->section;
		return $data;
	}

	protected function get_user_numbers() {

		$this->load->model('vbx_device');
		$numbers = $this->vbx_device->get_by_user($this->user_id);
		
		return $numbers;
	}

	protected function message_counts() {
		$groups = VBX_User::get_group_ids($this->user_id);
		$counts = $this->vbx_message->get_folders($this->user_id, $groups);
		return $counts;
	}

	protected function get_twilio_numbers() {
		$this->load->model('vbx_incoming_numbers');
		$numbers = array();
		try
		{
			/* Retrieve twilio numbers w/o sandbox */
			$numbers = $this->vbx_incoming_numbers->get_numbers(false);
		}
		catch(VBX_IncomingNumberException $e)
		{
			error_log($e->getMessage());
			throw new User_ControllerException($e->getMessage());
			/* Silent fail */
		}

		return $numbers;
	}
	
	/* Used to give access to internals via rest-based calls */
	protected function make_rest_access()
	{
		/* Set a cookie for Rest Access */
		$this->load->model('vbx_rest_access');
		return $this->vbx_rest_access->make_key($this->session->userdata('user_id'));
	}

	public function get_tenant()
	{
		return $this->tenant;
	}

}
