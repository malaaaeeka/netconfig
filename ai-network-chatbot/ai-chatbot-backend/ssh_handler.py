from netmiko import ConnectHandler, NetmikoTimeoutException, NetmikoAuthenticationException

def execute_commands(host, username, password, commands, use_gns3=False):
    
  
    if use_gns3:
        device = {
            'device_type': 'cisco_ios_telnet',
            'host': '127.0.0.1',
            'port': 5001,
            'username': 'admin',
            'password': 'cisco123',
            'secret': 'cisco123',
            'timeout': 30,
            'global_delay_factor': 2,
            'session_log': None,
            'fast_cli': False,
    }
    else:
        # Real router — SSH, uses whatever the user typed in
        device = {
            'device_type': 'cisco_ios',
            'host': host,
            'username': username,
            'password': password,
            'secret': password,
            'timeout': 20,
            'global_delay_factor': 2,
        }

    try:
        connection = ConnectHandler(**device)
        connection.enable()
        output = connection.send_config_set(commands)
        connection.disconnect()
        target = '127.0.0.1 (GNS3)' if use_gns3 else host
        return {'success': True, 'output': output, 'message': f'Successfully configured {target}'}

    except NetmikoTimeoutException:
        target = 'GNS3 simulator' if use_gns3 else f'router at {host}'
        return {'success': False, 'error': f'Cannot reach {target}'}
    except NetmikoAuthenticationException:
        return {'success': False, 'error': 'Authentication failed'}
    except Exception as e:
        return {'success': False, 'error': str(e)}